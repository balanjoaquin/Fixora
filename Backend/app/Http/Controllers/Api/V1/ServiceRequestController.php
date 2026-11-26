<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\RequestEvent;
use App\Models\ServiceRequest;
use App\Models\Specialty;
use App\Models\TechnicianProfile;
use App\Models\User;
use BackedEnum;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ServiceRequestController extends Controller
{
    private const RELATIONS = [
        'client',
        'specialty',
        'review',
        'technicianProfile.user',
        'technicianService',
        'events.actor',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role instanceof BackedEnum ? (string) $user->role->value : (string) $user->role;

        $query = ServiceRequest::query()
            ->with(self::RELATIONS)
            ->latest();

        if ($role === 'technician') {
            $profileId = $user->technicianProfile?->id;
            if (! $profileId) {
                return response()->json(['data' => []]);
            }
            $query->where('technician_profile_id', $profileId);
        } elseif ($role !== 'admin') {
            $query->where('client_id', $user->id);
        }

        return response()->json([
            'data' => $query->get(),
        ]);
    }

    public function show(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->canAccessRequest($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        return response()->json([
            'data' => $serviceRequest->load(self::RELATIONS),
        ]);
    }

    public function messages(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->canAccessRequest($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $events = $serviceRequest->events()
            ->with('actor')
            ->whereNotNull('reason')
            ->where('reason', '!=', '')
            ->get()
            ->map(fn (RequestEvent $ev): array => $this->formatMessageEvent($ev));

        return response()->json([
            'data' => $events,
        ]);
    }

    public function sendMessage(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->canAccessRequest($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:1500'],
            'proposed_price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
        ]);

        $user = $request->user();
        $role = $user->role instanceof BackedEnum ? (string) $user->role->value : (string) $user->role;

        $rawMessage = trim((string) $validated['message']);
        $price = isset($validated['proposed_price']) && $validated['proposed_price'] !== ''
            ? (float) $validated['proposed_price']
            : null;

        $storedReason = $price !== null
            ? sprintf('[COTIZACIÓN: $%s MXN] %s', number_format($price, 2, '.', ''), $rawMessage)
            : $rawMessage;

        $currentStatus = $serviceRequest->status instanceof BackedEnum
            ? (string) $serviceRequest->status->value
            : (string) $serviceRequest->status;

        $event = RequestEvent::create([
            'service_request_id' => $serviceRequest->id,
            'from_status' => $currentStatus,
            'to_status' => $currentStatus,
            'actor_id' => $user->id,
            'actor_role' => in_array($role, ['client', 'technician', 'admin'], true) ? $role : 'client',
            'reason' => $storedReason,
            'created_at' => now(),
        ]);

        $serviceRequest->loadMissing(['client', 'technicianProfile.user']);
        $folio = sprintf('FX-%04d', $serviceRequest->id);

        if ($role === 'technician' && $serviceRequest->client) {
            $title = $price !== null
                ? sprintf('Nueva cotización ($%s MXN) en %s', number_format($price, 0), $folio)
                : sprintf('Nuevo mensaje del técnico en %s', $folio);

            $this->pushDatabaseNotification(
                $serviceRequest->client,
                $price !== null ? 'quote_received' : 'request_message',
                $title,
                Str::limit($rawMessage, 110),
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        } elseif ($serviceRequest->technicianProfile?->user) {
            $this->pushDatabaseNotification(
                $serviceRequest->technicianProfile->user,
                'request_message',
                sprintf('Respuesta del cliente en %s', $folio),
                Str::limit($rawMessage, 110),
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Mensaje enviado.',
            'data' => $this->formatMessageEvent($event->load('actor')),
        ], 201);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'technician_profile_id' => ['nullable', 'integer'],
            'technician_id' => ['nullable', 'integer'],
            'specialty_id' => ['nullable', 'integer', 'exists:specialties,id'],
            'specialty_name' => ['required_without:specialty_id', 'nullable', 'string', 'max:120'],
            'technician_service_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['required', 'string', 'max:3000'],
            'approx_zone' => ['nullable', 'string', 'max:150'],
            'neighborhood' => ['nullable', 'string', 'max:150'],
            'zone' => ['nullable', 'string', 'max:150'],
            'address_line' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'preferred_date' => ['required', 'date'],
            'preferred_start' => ['nullable', 'string', 'max:20'],
            'preferred_time' => ['nullable', 'string', 'max:20'],
            'photos' => ['nullable', 'array', 'max:4'],
            'photos.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $rawTechId = (int) ($validated['technician_profile_id'] ?? $validated['technician_id'] ?? 0);
        $profile = TechnicianProfile::find($rawTechId)
            ?? TechnicianProfile::where('user_id', $rawTechId)->first();

        if (! $profile) {
            return response()->json([
                'message' => 'Debes seleccionar un técnico especialista válido.',
            ], 422);
        }

        $specialtyId = $validated['specialty_id'] ?? null;
        if (! $specialtyId && ! empty($validated['specialty_name'])) {
            $cleanName = trim((string) $validated['specialty_name']);
            $slug = Str::slug($cleanName);

            $specialtyData = ['name' => $cleanName];
            if (Schema::hasColumn('specialties', 'is_active')) {
                $specialtyData['is_active'] = true;
            }

            $specialty = Specialty::firstOrCreate(
                ['slug' => $slug !== '' ? $slug : Str::random(8)],
                $specialtyData
            );

            $specialtyId = $specialty->id;
        }

        $photoUrls = [];
        $uploadedPhotos = $request->file('photos');
        if (is_array($uploadedPhotos)) {
            foreach ($uploadedPhotos as $file) {
                if ($file instanceof UploadedFile) {
                    $path = $file->store('fixora/requests', 'public');
                    $photoUrls[] = url('storage/' . $path);
                }
            }
        }

        $zoneValue = trim((string) (
            $validated['approx_zone'] ?? $validated['neighborhood'] ?? $validated['zone'] ?? ''
        ));
        $addressValue = trim((string) ($validated['address_line'] ?? $validated['address'] ?? ''));
        $timeValue = trim((string) ($validated['preferred_start'] ?? $validated['preferred_time'] ?? ''));

        $serviceRequest = ServiceRequest::create([
            'client_id' => $request->user()->id,
            'technician_profile_id' => (int) $profile->id,
            'specialty_id' => $specialtyId,
            'technician_service_id' => ! empty($validated['technician_service_id']) ? (int) $validated['technician_service_id'] : null,
            'title' => trim((string) $validated['title']),
            'description' => trim((string) $validated['description']),
            'photos' => $photoUrls !== [] ? $photoUrls : null,
            'approx_zone' => $zoneValue !== '' ? $zoneValue : null,
            'address_line' => $addressValue !== '' ? $addressValue : null,
            'preferred_date' => $validated['preferred_date'],
            'preferred_start' => $timeValue !== '' ? $timeValue : null,
            'status' => 'pending',
            'expires_at' => now()->addHours(48),
        ]);

        $serviceRequest->load(self::RELATIONS);

        if ($serviceRequest->technicianProfile?->user) {
            $folio = sprintf('FX-%04d', $serviceRequest->id);
            $this->pushDatabaseNotification(
                $serviceRequest->technicianProfile->user,
                'new_service_request',
                sprintf('Nueva solicitud recibida (%s)', $folio),
                sprintf('%s solicitó: %s', $request->user()->name, $serviceRequest->title),
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Solicitud de servicio creada correctamente.',
            'data' => $serviceRequest,
        ], 201);
    }

    public function cancel(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->canAccessRequest($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado para cancelar esta solicitud.'], 403);
        }

        $reason = trim((string) (
            $request->input('reason')
            ?? $request->input('closing_reason')
            ?? $request->input('cancellation_reason')
            ?? ''
        ));

        $serviceRequest->update([
            'status' => 'cancelled',
            'closed_at' => now(),
            'closed_by' => $request->user()->id,
            'closing_reason' => $reason !== '' ? $reason : null,
        ]);

        $serviceRequest->loadMissing(['client', 'technicianProfile.user']);
        $folio = sprintf('FX-%04d', $serviceRequest->id);
        $actor = $request->user();

        if ((int) $actor->id === (int) $serviceRequest->client_id && $serviceRequest->technicianProfile?->user) {
            $this->pushDatabaseNotification(
                $serviceRequest->technicianProfile->user,
                'request_cancelled',
                sprintf('Solicitud %s cancelada por el cliente', $folio),
                $reason !== '' ? $reason : $serviceRequest->title,
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        } elseif ($serviceRequest->client) {
            $this->pushDatabaseNotification(
                $serviceRequest->client,
                'request_cancelled',
                sprintf('Tu orden %s fue cancelada', $folio),
                $reason !== '' ? $reason : $serviceRequest->title,
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Solicitud cancelada correctamente.',
            'data' => $serviceRequest->fresh(self::RELATIONS),
        ]);
    }

    public function destroy(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        return $this->cancel($request, $serviceRequest);
    }

    public function accept(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->ownsAsTechnician($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $serviceRequest->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        $serviceRequest->loadMissing(['client', 'technicianProfile.user']);
        if ($serviceRequest->client) {
            $folio = sprintf('FX-%04d', $serviceRequest->id);
            $this->pushDatabaseNotification(
                $serviceRequest->client,
                'request_accepted',
                sprintf('¡Solicitud %s aceptada!', $folio),
                sprintf('%s confirmó tu servicio: %s', $request->user()->name, $serviceRequest->title),
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Solicitud aceptada.',
            'data' => $serviceRequest->fresh(self::RELATIONS),
        ]);
    }

    public function reject(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->ownsAsTechnician($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $reason = trim((string) ($request->input('reason') ?? ''));

        $serviceRequest->update([
            'status' => 'rejected',
            'closed_at' => now(),
            'closed_by' => $request->user()->id,
            'closing_reason' => $reason !== '' ? $reason : null,
        ]);

        $serviceRequest->loadMissing(['client']);
        if ($serviceRequest->client) {
            $folio = sprintf('FX-%04d', $serviceRequest->id);
            $this->pushDatabaseNotification(
                $serviceRequest->client,
                'request_rejected',
                sprintf('Solicitud %s rechazada por el técnico', $folio),
                $reason !== '' ? $reason : 'Puedes elegir otro especialista disponible.',
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Solicitud rechazada.',
            'data' => $serviceRequest->fresh(self::RELATIONS),
        ]);
    }

    public function start(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->ownsAsTechnician($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $serviceRequest->update([
            'status' => 'in_progress',
            'started_at' => now(),
        ]);

        $serviceRequest->loadMissing(['client']);
        if ($serviceRequest->client) {
            $folio = sprintf('FX-%04d', $serviceRequest->id);
            $this->pushDatabaseNotification(
                $serviceRequest->client,
                'request_started',
                sprintf('Servicio %s en proceso', $folio),
                sprintf('%s inició el trabajo: %s', $request->user()->name, $serviceRequest->title),
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Servicio iniciado.',
            'data' => $serviceRequest->fresh(self::RELATIONS),
        ]);
    }

    public function complete(Request $request, ServiceRequest $serviceRequest): JsonResponse
    {
        if (! $this->ownsAsTechnician($request, $serviceRequest)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $currentStatus = $serviceRequest->status instanceof BackedEnum
            ? (string) $serviceRequest->status->value
            : (string) $serviceRequest->status;

        $serviceRequest->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        if ($currentStatus !== 'completed' && $serviceRequest->technician_profile_id && Schema::hasColumn('technician_profiles', 'completed_count')) {
            TechnicianProfile::where('id', $serviceRequest->technician_profile_id)->increment('completed_count');
        }

        $serviceRequest->loadMissing(['client']);
        if ($serviceRequest->client) {
            $folio = sprintf('FX-%04d', $serviceRequest->id);
            $this->pushDatabaseNotification(
                $serviceRequest->client,
                'request_completed',
                sprintf('Servicio %s finalizado', $folio),
                'Ya puedes calificar la atención y calidad del especialista.',
                ['service_request_id' => $serviceRequest->id, 'target_tab' => 'requests']
            );
        }

        return response()->json([
            'message' => 'Servicio completado.',
            'data' => $serviceRequest->fresh(self::RELATIONS),
        ]);
    }

    private function pushDatabaseNotification(
        User $recipient,
        string $eventType,
        string $title,
        string $body,
        array $meta = []
    ): void {
        if (! Schema::hasTable('notifications')) {
            return;
        }

        $recipient->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\FixoraEventNotification',
            'data' => array_merge([
                'event' => $eventType,
                'title' => $title,
                'message' => $body,
                'body' => $body,
            ], $meta),
            'read_at' => null,
        ]);
    }

    private function formatMessageEvent(RequestEvent $event): array
    {
        $raw = (string) ($event->reason ?? '');
        $proposedPrice = null;
        $cleanMessage = $raw;

        if (preg_match('/^\[COTIZACIÓN:\s*\$([0-9]+(?:\.[0-9]{1,2})?)\s*MXN\]\s*(.*)$/su', $raw, $matches)) {
            $proposedPrice = (float) $matches[1];
            $cleanMessage = trim($matches[2]);
        }

        $actorRole = $event->actor_role instanceof BackedEnum
            ? (string) $event->actor_role->value
            : (string) $event->actor_role;

        return [
            'id' => $event->id,
            'actor_id' => $event->actor_id,
            'actor_role' => $actorRole,
            'actor_name' => $event->actor?->name ?? ($actorRole === 'technician' ? 'Técnico' : 'Cliente'),
            'message' => $cleanMessage,
            'proposed_price' => $proposedPrice,
            'created_at' => $event->created_at?->toISOString(),
        ];
    }

    private function canAccessRequest(Request $request, ServiceRequest $serviceRequest): bool
    {
        $user = $request->user();
        $role = $user->role instanceof BackedEnum ? (string) $user->role->value : (string) $user->role;

        if ($role === 'admin') {
            return true;
        }

        if ((int) $serviceRequest->client_id === (int) $user->id) {
            return true;
        }

        return $this->ownsAsTechnician($request, $serviceRequest);
    }

    private function ownsAsTechnician(Request $request, ServiceRequest $serviceRequest): bool
    {
        $profileId = $request->user()->technicianProfile?->id;

        return $profileId !== null && (int) $serviceRequest->technician_profile_id === (int) $profileId;
    }
}
import {
  Plug,
  Droplets,
  Hammer,
  Paintbrush,
  Laptop,
  Smartphone,
  Tv,
  Wind,
  Shield,
  Zap,
  Star,
  Lock,
  FileText,
  MapPin,
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";
import type { ServiceStatus, SpecialtyCategory } from "@/types";

export const SPECIALTIES: SpecialtyCategory[] = [
  {
    id: "electricista",
    label: "Electricista",
    description: "Instalaciones, cortos circuitos, tableros y luminarias.",
    icon: Plug,
    bg: "bg-amber-50",
    color: "text-amber-600",
  },
  {
    id: "plomero",
    label: "Plomero",
    description: "Fugas, tuberías, bombas de agua, tinacos y sanitarios.",
    icon: Droplets,
    bg: "bg-sky-50",
    color: "text-sky-600",
  },
  {
    id: "carpintero",
    label: "Carpintero",
    description: "Puertas, closets, muebles a medida y reparaciones.",
    icon: Hammer,
    bg: "bg-orange-50",
    color: "text-orange-600",
  },
  {
    id: "pintor",
    label: "Pintor",
    description: "Interiores, exteriores, impermeabilización y acabados.",
    icon: Paintbrush,
    bg: "bg-rose-50",
    color: "text-rose-600",
  },
  {
    id: "computadoras",
    label: "Computadoras",
    description: "Mantenimiento preventivo, redes, hardware y software.",
    icon: Laptop,
    bg: "bg-indigo-50",
    color: "text-indigo-600",
  },
  {
    id: "celulares",
    label: "Celulares",
    description: "Cambio de pantalla, baterías, centros de carga y diagnóstico.",
    icon: Smartphone,
    bg: "bg-emerald-50",
    color: "text-emerald-600",
  },
  {
    id: "electrodomesticos",
    label: "Electrodomésticos",
    description: "Lavadoras, refrigeradores, estufas y microondas.",
    icon: Tv,
    bg: "bg-red-50",
    color: "text-red-600",
  },
  {
    id: "aire-acondicionado",
    label: "Aire acondicionado",
    description: "Instalación, carga de gas, limpieza y mantenimiento.",
    icon: Wind,
    bg: "bg-cyan-50",
    color: "text-cyan-600",
  },
];

export const CLIENT_BENEFITS = [
  {
    icon: Shield,
    title: "Técnicos verificados",
    desc: "Validamos identidad, especialidad y experiencia antes de habilitar cada perfil.",
  },
  {
    icon: Zap,
    title: "Respuesta rápida",
    desc: "Envía tu solicitud en menos de dos minutos y recibe atención oportuna.",
  },
  {
    icon: Star,
    title: "Calificaciones transparentes",
    desc: "Consulta reseñas reales de otros servicios completados antes de elegir.",
  },
  {
    icon: Lock,
    title: "Pago protegido",
    desc: "Tu pago permanece resguardado hasta que confirmas la entrega del servicio.",
  },
  {
    icon: FileText,
    title: "Historial ordenado",
    desc: "Conserva cada folio, diagnóstico y garantía en tu panel de cliente.",
  },
  {
    icon: MapPin,
    title: "Seguimiento claro",
    desc: "Visualiza cada etapa: pendiente, aceptada, en proceso y finalizada.",
  },
];

export const TECH_BENEFITS = [
  {
    icon: Users,
    title: "Más clientes en tu zona",
    desc: "Conecta con personas que buscan exactamente tu especialidad cerca de ti.",
  },
  {
    icon: Briefcase,
    title: "Órdenes centralizadas",
    desc: "Administra solicitudes, cotizaciones y trabajos activos desde un solo tablero.",
  },
  {
    icon: Calendar,
    title: "Agenda flexible",
    desc: "Define tus bloques horarios y evita empalmes entre visitas técnicas.",
  },
  {
    icon: TrendingUp,
    title: "Crecimiento profesional",
    desc: "Aumenta tu visibilidad conforme acumulas trabajos finalizados y buenas reseñas.",
  },
  {
    icon: Star,
    title: "Reputación verificada",
    desc: "Cada servicio concluido respalda tu perfil con calificaciones auténticas.",
  },
  {
    icon: Clock,
    title: "Control de disponibilidad",
    desc: "Activa o pausa tu disponibilidad en tiempo real con un solo clic.",
  },
];

export const CLIENT_FAQ = [
  {
    q: "¿Cómo solicito un técnico en Fixora?",
    a: "Crea tu cuenta gratuita, selecciona la especialidad que necesitas, indica fecha, horario y una breve descripción del problema para enviar tu orden.",
  },
  {
    q: "¿Cómo funciona la protección de pago?",
    a: "El monto acordado queda en resguardo durante la ejecución del trabajo y se libera al técnico cuando confirmas que el servicio fue completado.",
  },
  {
    q: "¿Puedo cancelar una solicitud antes de que inicie?",
    a: "Sí. Desde la sección 'Mis Solicitudes' puedes cancelar cualquier orden pendiente antes de que el técnico inicie el servicio.",
  },
];

export const TECH_FAQ = [
  {
    q: "¿Cómo me registro como técnico?",
    a: "Crea tu cuenta gratuita, selecciona tu especialidad principal, indica tus años de experiencia y zona de cobertura para activar tu perfil.",
  },
  {
    q: "¿Tiene algún costo unirse a Fixora?",
    a: "El registro y la creación de tu perfil profesional son gratuitos. Solo se aplica una comisión por servicio finalizado exitosamente.",
  },
  {
    q: "¿Cómo recibo mis pagos?",
    a: "Una vez que el cliente confirma la finalización del servicio, el saldo pasa a tu balance disponible para retiro bancario.",
  },
  {
    q: "¿Puedo elegir mis horarios y zona de trabajo?",
    a: "Sí. Desde tu panel puedes activar o pausar tu disponibilidad y administrar los bloques horarios de tu calendario semanal.",
  },
];

export const MEXICO_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
].map((state) => ({ value: state, label: state }));

export const EXPERIENCE_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20].map((years) => ({
  value: String(years),
  label: `${years} ${years === 1 ? "año" : "años"} de experiencia`,
}));

export const SERVICE_STATUS_META: Record<
  ServiceStatus,
  { badge: string; dot: string; hint: string }
> = {
  Pendiente: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    hint: "En espera de confirmación del técnico",
  },
  Aceptada: {
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    hint: "El técnico confirmó la visita programada",
  },
  "En proceso": {
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    dot: "bg-indigo-500",
    hint: "Servicio técnico en ejecución",
  },
  Finalizada: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    hint: "Trabajo concluido y verificado",
  },
  Cancelada: {
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    hint: "Orden cancelada",
  },
};

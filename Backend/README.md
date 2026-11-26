# FIXORA — Plataforma digital para la gestión y contratación de servicios de reparación y mantenimiento

Plataforma web y API REST construida con **Laravel 11**, **Livewire 3** y **Tailwind CSS** para conectar clientes que requieren servicios técnicos con técnicos independientes en Ciudad del Carmen, Campeche[cite: 4, 5].

## Requisitos
- PHP 8.2+ con extensiones `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`
- Composer 2.x
- MySQL 8.x (`InnoDB`, `utf8mb4`)
- Node.js y NPM (para compilar activos de interfaz)

## Instalación paso a paso
1. Clonar el repositorio e instalar dependencias:
   ```bash
   git clone <url-del-repositorio>
   cd Fixora_Web/Backend
   composer install
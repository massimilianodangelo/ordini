# GroupOrder Hub

## Overview

GroupOrder Hub is a production-ready SaaS platform for managing group orders in B2B environments. Built for organizations like offices, coworking spaces, residential buildings, and event organizers, it provides a complete solution for coordinating collective purchases with role-based access control, real-time cart management, and order tracking.

The platform follows a modern full-stack architecture using React 18 with TypeScript for the frontend, Express.js for the backend, and PostgreSQL with Drizzle ORM for data persistence. It implements a multi-tenant structure supporting different organizational groups with coordinators and administrators managing orders for their teams.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool and development server
- TanStack Query (React Query) for server state management and caching
- Wouter for lightweight client-side routing
- Tailwind CSS with shadcn/ui component library for consistent UI design

**Key Design Patterns:**
- Context-based state management for authentication (`AuthContext`) and shopping cart (`CartContext`)
- Custom hooks pattern for reusable logic (`use-auth`, `use-cart`, `use-classes`)
- Protected route components enforcing role-based access control
- Form validation using react-hook-form with Zod schemas
- Optimistic UI updates with React Query mutations

**Frontend Structure:**
- `/client/src/pages/` - Route-level components (home, admin, auth, orders)
- `/client/src/components/ui/` - Reusable UI components from shadcn/ui
- `/client/src/hooks/` - Custom React hooks for shared logic
- `/client/src/lib/` - Utility functions and query client configuration

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM for type-safe database operations
- Passport.js with local strategy for session-based authentication
- Express sessions with in-memory storage (development) or PostgreSQL storage (production via connect-pg-simple)

**Authentication & Authorization:**
- Password hashing using Node.js crypto scrypt algorithm
- Session-based authentication with secure cookie handling
- Three-tier role system: regular users, coordinators, and administrators
- Special handling for admin accounts using SHA-256 for backward compatibility

**API Design:**
- RESTful API endpoints under `/api/*` prefix
- Session validation middleware protecting authenticated routes
- Role-based middleware (`requireAdmin`, `requireCoordinator`) for access control
- Centralized error handling with appropriate HTTP status codes

**Data Persistence Strategy:**
- Hybrid storage approach: PostgreSQL for production, file-based JSON for development fallback
- Local storage file (`storage/app-data.json`) provides data persistence when database is unavailable
- Automatic fallback mechanisms ensure application resilience

**Backend Structure:**
- `/server/index.ts` - Application entry point and middleware setup
- `/server/routes.ts` - API route definitions and handlers
- `/server/auth.ts` - Authentication strategy and password handling
- `/server/storage.ts` - Data access layer with database and file storage abstraction

### Database Schema

**Core Entities:**

1. **Users Table**
   - Stores user credentials, profile information, and role flags
   - Fields: id, username, password, firstName, lastName, groupName, email, isCoordinator, isAdmin, isUserAdmin
   - Supports multi-tenant organization through groupName field

2. **Products Table**
   - Product catalog with pricing and availability
   - Fields: id, name, description, price, category, available
   - Categories include: Beverages, Snacks, Meals, Supplies

3. **Orders Table**
   - Order headers tracking status and totals
   - Fields: id, userId, status, total, createdAt, orderDate
   - Status flow: pending → processing → completed/cancelled
   - Foreign key relationship to users table

4. **OrderItems Table**
   - Line items connecting orders to products with quantities
   - Fields: id, orderId, productId, quantity, price
   - Maintains price snapshot for historical accuracy
   - Foreign keys to both orders and products tables

**Data Relationships:**
- One-to-many: User → Orders
- One-to-many: Order → OrderItems
- Many-to-one: OrderItem → Product

### External Dependencies

**Database Services:**
- PostgreSQL 14+ (primary data store)
- Compatible with cloud providers: Neon, Supabase, or self-hosted
- Connection via `@neondatabase/serverless` package for serverless compatibility
- Environment variable `DATABASE_URL` configures connection string

**UI Component Library:**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui as the component layer built on Radix
- Provides 30+ production-ready components (dialogs, dropdowns, forms, tables, etc.)

**Development Tools:**
- Drizzle Kit for database migrations and schema management
- ESBuild for server-side bundling in production builds
- TypeScript compiler for type checking across the codebase

**Session Storage:**
- Memory-based sessions in development (memorystore package)
- PostgreSQL-backed sessions in production (connect-pg-simple package)
- Automatic session cleanup and expiration handling

**Styling & Theming:**
- PostCSS with Tailwind CSS for utility-first styling
- Custom theme configuration via `theme.json`
- CSS custom properties for dynamic theming support
- Replit-specific theme plugin for editor integration

**No External APIs:**
- System operates entirely self-contained
- No third-party payment processors, email services, or external integrations
- Authentication and data storage handled internally
- Ready for future integration additions (payment gateways, notification services)
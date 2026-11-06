# HealthSchedule • Monthly Shift & On-Call Schedule Manager

[![Deploy to GitHub Pages](https://github.com/pleaobraga/health-schedule/actions/workflows/deploy.yml/badge.svg)](https://github.com/pleaobraga/health-schedule/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Demo-GitHub%20Pages-indigo?style=flat&logo=github)](https://pleaobraga.github.io/health-schedule/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A modern, offline-first Monthly Shift and On-Call Schedule Manager for healthcare teams, clinics, and emergency departments. Built with **React 19**, **TypeScript**, **Tailwind CSS**, **Zustand**, and **Firebase**.

🔗 **Live Demo**: [https://pleaobraga.github.io/health-schedule/](https://pleaobraga.github.io/health-schedule/)

---

## 🌟 Overview & Key Features

HealthSchedule streamlines the complexity of medical roster planning through an intuitive calendar interface, real-time labor compliance auditing, and flexible shift pricing.

- 📅 **Interactive Schedule Calendar**: Monthly grid with instant day allocations, candidate availability filters, unsaved changes protection, and high-contrast print-optimized export.
- ⚙️ **Custom Shifts & Dynamic Rule Engine**: Define customizable shifts (12h, 24h, custom hours) with real-time compliance auditing (consecutive day limits, minimum rest, maximum weekly/monthly hours).
- 💰 **Shift Rates & Financial Reports**: Configure base and surge rates per professional/day (weekends, holidays) and generate instant monthly payment summaries.
- 🧾 **Purchases & Daily Expenses (`/compras`)**: Record daily expenses and multi-item purchases (as professional reimbursements or general operational costs), import item lines from `.xls` / `.xlsx` spreadsheets, track per-item restocking intervals and repurchase history, maintain the item catalog (rename/merge), and review totals in the monthly financial closing.
- 💊 **Versioned Medication Schedule (`/medicamentos`)**: Track medication administration schedules with free-text dosages and time slots, source groupings, historical prescription versions with automatic diff change summaries, historical date lookup, and print/PDF export.
- 👥 **Staff Registry & Referential Integrity**: Centralized staff management with custom color coding and soft-delete protection for historical allocations.
- 💾 **Offline-First & Multi-Profile Guest Mode**: Works 100% offline via browser storage with instant dynamic demo seed data; supports multi-profile guest accounts and optional Firebase Cloud Sync for administrators.
- 📊 **Export & Data Portability**: Multi-sheet formatted Excel reports (`.xlsx`), JSON snapshot backups, and cloud recovery.
- 🌐 **Bilingual (i18n) & Dark Theme**: Full native support for Brazilian Portuguese (`pt-BR`) and English (`en-US`), with system/manual dark mode toggling.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS, shadcn/ui date picker, Lucide Icons |
| **State & Storage** | Zustand, Browser LocalStorage (Firestore offline cache in IndexedDB) |
| **Cloud & Auth** | Firebase 13 (Auth, Firestore Cloud Sync) |
| **Reporting & i18n** | SheetJS (XLSX), i18next & react-i18next |
| **Quality & Tests** | Vitest, React Testing Library, ESLint, Husky, Storybook 10 |

---

## 🏗️ System Architecture

```mermaid
graph TD
    User([User Browser])

    subgraph UI_Layer [Presentation Layer]
        Router[HashRouter & Route Guards]
        AuthGuard[PrivateRoute & AdminRoute]
        Layout[RootLayout & HoverSidebar]
        CalendarView[Calendar View & Grid]
        PeopleView[People Management View]
        ShiftsView[Shifts Management View]
        RulesView[Rules Management View]
        AddressView[Address Management View]
        PurchasesView[Purchases & Item History View]
        MedicationsView[Medications Schedule View]
        ImportView[Import / Cloud Pull View]
        SettingsView[Settings & Cloud Toggle]
        UsersView[User Management View]
    end

    subgraph State_Layer [Global State & Auth Context]
        AuthContext[AuthContext - Firebase User, Role & Guest Profiles]
        Store[Zustand Store: useScheduleStore]
    end

    subgraph Cloud_Layer [Firebase Cloud Services]
        FirebaseAuth[Firebase Authentication]
        Firestore[Firestore Cloud Database]
        CloudSync[CloudSyncService]
    end

    subgraph Business_Layer [Pure Logic & Utilities]
        RuleEngine[Rule Engine & Compliance Validator]
        DateUtils[Date & Calendar Engine]
        ShiftRates[Shift Rates & Financial Calculations]
        ExcelExport[SheetJS Multi-Sheet Excel Generator]
        PersonService[Referential Integrity Service]
        BackupService[Backup & Snapshot Manager]
        SeedLoader[Dynamic Guest Seed Loader]
    end

    subgraph Storage_Layer [Persistence Layer]
        StorageService[StorageService - LocalStorage Engine & Dataset Isolation]
        LocalStorage[(Browser LocalStorage / Cache)]
    end

    User --> Router
    Router --> AuthGuard
    AuthGuard --> Layout
    Layout --> CalendarView
    Layout --> PeopleView
    Layout --> ShiftsView
    Layout --> RulesView
    Layout --> AddressView
    Layout --> PurchasesView
    Layout --> MedicationsView
    Layout --> ImportView
    Layout --> SettingsView
    Layout --> UsersView

    CalendarView --> Store
    PeopleView --> Store
    ShiftsView --> Store
    RulesView --> Store
    AddressView --> Store
    PurchasesView --> Store
    MedicationsView --> Store
    ImportView --> Store
    SettingsView --> Store
    UsersView --> Firestore

    Store --> RuleEngine
    Store --> DateUtils
    Store --> ShiftRates
    Store --> ExcelExport
    Store --> PersonService
    Store --> BackupService
    Store --> StorageService
    Store --> CloudSync

    SeedLoader --> Store
    SeedLoader --> StorageService

    CloudSync --> Firestore
    AuthContext --> FirebaseAuth
    AuthContext --> Firestore
    AuthContext --> StorageService
    StorageService --> LocalStorage
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `>= 24.22.0`
- **pnpm**: `>= 12.14.0`

### Setup

```bash
# Clone repository
git clone https://github.com/pleaobraga/health-schedule.git
cd health-schedule

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`.

### Environment Configuration

Firebase is optional. For account login and cloud synchronization, copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

_(Note: Without these values the app runs in guest mode, entirely on local storage, and the login page offers only the guest entry. Tests don't need `.env.local`.)_

---

## 🧪 Available Scripts

| Command          | Description                                                 |
| :--------------- | :---------------------------------------------------------- |
| `pnpm dev`       | Starts Vite development server with HMR                     |
| `pnpm build`     | Compiles TypeScript and creates optimized production bundle |
| `pnpm test`      | Runs unit and integration tests with Vitest                 |
| `pnpm test:run`  | Executes tests once in headless mode                        |
| `pnpm lint`      | Runs ESLint flat config validation                          |
| `pnpm lint:fix`  | Automatically fixes linting and formatting issues           |
| `pnpm typecheck` | Validates TypeScript types across the codebase              |
| `pnpm validate`  | Full pipeline: typecheck + lint + test                      |
| `pnpm storybook` | Starts Storybook component workshop                         |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

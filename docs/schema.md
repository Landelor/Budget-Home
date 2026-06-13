# Database Schema

ORM: Drizzle + PostgreSQL. Migration files in `packages/db/drizzle/`.

## ERD

```
┌──────────────────────────────────┐
│              users               │
├──────────────────────────────────┤
│ id           uuid  PK            │
│ email        varchar(255) UNIQUE │
│ password_hash varchar(255)       │
│ created_at   timestamp           │
└──────────┬───────────────────────┘
           │ 1
           │
    ┌──────┴──────┬────────────────────────────┐
    │ n           │ n                           │ n
    ▼             ▼                             ▼
┌───────────────────────┐   ┌───────────────────────────────────────┐
│       accounts        │   │              categories               │
├───────────────────────┤   ├───────────────────────────────────────┤
│ id           uuid PK  │   │ id            uuid  PK                │
│ user_id      uuid FK→users│ user_id       uuid  FK→users (null=system default)
│ name         varchar  │   │ name          varchar(100)            │
│ type         enum     │   │ color         varchar(7) (hex)        │
│   checking/savings/   │   │ icon          varchar(50)             │
│   credit/cash         │   │ parent_category_id uuid FK→categories │
│ currency     varchar  │   └───────────────────────────────────────┘
│ current_balance numeric│            │ 1            │ 1
│ created_at   timestamp│             │              │
└───────┬───────────────┘             │ n            │ n
        │ 1                           ▼              ▼
        │ n               ┌───────────────────────┐  ┌──────────────────────────────────┐
        ▼                 │     transactions      │  │           budgets                │
┌───────────────────────┐ ├───────────────────────┤  ├──────────────────────────────────┤
│     transactions      │ │ id          uuid PK   │  │ id           uuid  PK            │
│  (see full table →)   │ │ account_id  uuid FK   │  │ user_id      uuid  FK→users      │
└───────────────────────┘ │ user_id     uuid FK   │  │ category_id  uuid  FK→categories │
                          │ amount      numeric   │  │ period       enum monthly/weekly  │
                          │ date        date      │  │ limit_amount numeric(12,2)        │
                          │ description varchar   │  │ start_date   date                │
                          │ category_id uuid FK   │  │ created_at   timestamp           │
                          │ is_recurring boolean  │  └──────────────────────────────────┘
                          │ created_at  timestamp │
                          └───────────────────────┘
```

## Tables

### users
| Column        | Type         | Constraints           |
|---------------|--------------|-----------------------|
| id            | uuid         | PK, default random    |
| email         | varchar(255) | NOT NULL, UNIQUE      |
| password_hash | varchar(255) | NOT NULL              |
| created_at    | timestamp    | NOT NULL, default now |

### categories
| Column             | Type        | Constraints                              |
|--------------------|-------------|------------------------------------------|
| id                 | uuid        | PK, default random                       |
| user_id            | uuid        | FK → users.id CASCADE, **nullable** (null = system default) |
| name               | varchar(100)| NOT NULL                                 |
| color              | varchar(7)  | NOT NULL (hex code, e.g. `#F59E0B`)      |
| icon               | varchar(50) | NOT NULL (icon slug)                     |
| parent_category_id | uuid        | FK → categories.id SET NULL, nullable    |

### accounts
| Column          | Type          | Constraints                    |
|-----------------|---------------|--------------------------------|
| id              | uuid          | PK, default random             |
| user_id         | uuid          | NOT NULL, FK → users.id CASCADE|
| name            | varchar(100)  | NOT NULL                       |
| type            | account_type  | NOT NULL enum (checking/savings/credit/cash) |
| currency        | varchar(3)    | NOT NULL, default `USD`        |
| current_balance | numeric(12,2) | NOT NULL, default `0`          |
| created_at      | timestamp     | NOT NULL, default now          |

### transactions
| Column       | Type          | Constraints                          |
|--------------|---------------|--------------------------------------|
| id           | uuid          | PK, default random                   |
| account_id   | uuid          | NOT NULL, FK → accounts.id CASCADE   |
| user_id      | uuid          | NOT NULL, FK → users.id CASCADE      |
| amount       | numeric(12,2) | NOT NULL (negative = debit)          |
| date         | date          | NOT NULL                             |
| description  | varchar(255)  | NOT NULL                             |
| category_id  | uuid          | FK → categories.id SET NULL, nullable|
| is_recurring | boolean       | NOT NULL, default false              |
| created_at   | timestamp     | NOT NULL, default now                |

### budgets
| Column       | Type          | Constraints                             |
|--------------|---------------|-----------------------------------------|
| id           | uuid          | PK, default random                      |
| user_id      | uuid          | NOT NULL, FK → users.id CASCADE         |
| category_id  | uuid          | NOT NULL, FK → categories.id CASCADE    |
| period       | budget_period | NOT NULL enum (monthly/weekly)          |
| limit_amount | numeric(12,2) | NOT NULL                                |
| start_date   | date          | NOT NULL                                |
| created_at   | timestamp     | NOT NULL, default now                   |

## Enums

- **account_type**: `checking`, `savings`, `credit`, `cash`
- **budget_period**: `monthly`, `weekly`

## Design Notes

- `amount` on transactions is signed: positive = credit, negative = debit.
- `current_balance` on accounts is server-authoritative; never derived client-side.
- `categories.user_id = NULL` marks system-provided defaults shared across all users.
- All money columns use `numeric(12,2)` — no floating point.
- Cascade deletes flow: user → accounts/transactions/budgets/categories; account → transactions.

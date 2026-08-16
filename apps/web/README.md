# DonFlow web application

React and TypeScript frontend for the DonFlow scheduling platform.

## Local environment

Copy `.env.example` to `.env.local` and keep the API URL aligned with the NestJS
application:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Run the API and web application in separate terminals from the repository root:

```bash
npm run start:dev
npm run start:web
```

The web application is available at `http://localhost:5173`.

## Verification

```bash
npm run build:web
npm run lint:web
npm run test:web
```

The current screen is intentionally neutral. Product layout and visual decisions are
introduced only after the approved design direction.

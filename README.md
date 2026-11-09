# Boutique Beauty Retail

Boutique Beauty Retail is a responsive React storefront built with TypeScript, Vite, and Tailwind CSS. It provides a product catalogue, category filtering, search, sorting, pagination, customer sign-in and registration, a customer basket, and newsletter signup. The frontend calls the separate Spring Boot API; it does not process payments or arrange shipping.

## Requirements

- Node.js 18 or newer and npm
- The separate BeautyStore Backend API for live catalogue, account, basket, and newsletter data

## Run locally

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The API client defaults to `http://localhost:8080/api`.

Create a `.env.local` file in the project root with the local API URL and your Supabase project URL and **publishable/anon key**:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

Get the Supabase URL and publishable/anon key from the Supabase project settings. The frontend uses Supabase Auth for registration, sign-in, session refresh, and sign-out; it sends the current access token to protected API endpoints. Never use a Supabase secret or service-role key in frontend variables. Vite reads environment variables when the dev server starts, so restart it after changing them.

Start and configure the backend separately by following its README. It needs PostgreSQL, and the catalog must contain active categories and products with inventory. The backend must allow the frontend origin through its CORS configuration. For local development, the backend allows `http://localhost:5173` by default.

## Build

```sh
npm run build
npm run preview
```

The production build is written to `dist/`.

## Deploy on Netlify

Connect this repository to Netlify and use:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_API_BASE_URL` set to the deployed backend URL, including `/api`, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the same Supabase project

After deployment, add `https://boutiquebeautyretail.com` to the backend's allowed CORS origins. The frontend's local API default is for development only; a deployed site cannot use the visitor's `localhost` backend.


## Current scope

- Catalogue, category, search, sort, and pagination data come from the backend API.
- Registration, sign-in, session refresh, and sign-out use Supabase Auth. The application API provisions the customer profile on the first authenticated request.
- Basket operations require a signed-in customer and use product variant IDs.
- Newsletter signups are saved by the backend; no email campaign is sent.
- Checkout is a placeholder. No payment provider, shipping provider, customer order history, or admin UI is connected.

## Useful scripts

- `npm run dev` — start the local development server
- `npm run build` — type-check and create a production build
- `npm run preview` — serve the production build locally

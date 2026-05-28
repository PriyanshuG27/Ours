'use client'

/**
 * Offline fallback page served by the service worker when the app
 * cannot reach the network. Uses @ducanh2912/next-pwa's convention
 * of placing the fallback at app/_offline/page.tsx.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-neutral-500"
        >
          <line x1="2" x2="22" y1="2" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 12.86a10 10 0 0 1 5.17-2.86" />
          <line x1="12" x2="12.01" y1="20" y2="20" />
        </svg>
      </div>

      <h1 className="text-xl font-semibold text-white">You&apos;re offline</h1>
      <p className="mt-3 max-w-xs text-sm text-neutral-400">
        Ours will be back when you reconnect.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="mt-8 rounded-xl bg-neutral-800 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  )
}

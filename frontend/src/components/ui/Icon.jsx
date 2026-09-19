const paths = {
    shield: <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />,
    lock: (
        <>
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
    ),
    audit: (
        <>
            <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="14" r="2.5" />
        </>
    ),
    monitor: <path d="M2 12h4l2-6 4 12 2-8 2 4h6" />,
    users: (
        <>
            <circle cx="9" cy="8" r="3" />
            <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
            <circle cx="17" cy="9" r="2.5" />
            <path d="M22 20c0-2.6-2-4.8-4.8-5.6" />
        </>
    ),
    "arrow-right": (
        <>
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
        </>
    ),
    eye: (
        <>
            <path d="M1 12s3.5-8 11-8 11 8 11 8-3.5 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    "eye-off": (
        <>
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c5.5 0 9 5 9 8-.3.6-.7 1.3-1.3 2" />
            <path d="M6.1 6.1C4 7.5 2.4 9.6 1 12c1.5 3 5 8 11 8 1.4 0 2.6-.3 3.7-.7" />
        </>
    ),
    alert: (
        <>
            <path d="M12 2L1 21h22L12 2z" />
            <path d="M12 9v5M12 17h.01" />
        </>
    ),
    grid: (
        <>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
    ),
    menu: (
        <>
            <path d="M4 6h16M4 12h16M4 18h16" />
        </>
    ),
    file: (
        <>
            <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path d="M9 13h6M9 17h6" />
        </>
    ),
    book: (
        <>
            <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
            <path d="M19 19H6a2 2 0 0 1 0-4h13" />
        </>
    ),
    "x-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
        </>
    ),
    bell: (
        <>
            <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
            <path d="M10 21a2 2 0 0 0 4 0" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </>
    ),
    check: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
        </>
    ),
    "check-bare": <path d="M4 12l5 5L20 7" />,
    chevron: <path d="M9 6l6 6-6 6" />,
    logout: (
        <>
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
        </>
    ),
    heart: <path d="M12 21s-7-4.35-9.5-8.5C1 9 2 5 6 5c2 0 3.5 1.5 4 2.5.5-1 2-2.5 4-2.5 4 0 5 4 3.5 7.5C19 16.65 12 21 12 21z" />,
    pill: (
        <>
            <path d="M8.5 15.5l7-7a3.5 3.5 0 1 1 5 5l-7 7a3.5 3.5 0 1 1-5-5z" />
            <path d="M11.5 8.5l4 4" />
        </>
    ),
    download: (
        <>
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 21h16" />
        </>
    ),
    x: <path d="M18 6L6 18M6 6l12 12" />,
    "chevron-left": <path d="M15 6l-6 6 6 6" />,
    "chevrons-left": (
        <>
            <path d="M11 17l-5-5 5-5" />
            <path d="M18 17l-5-5 5-5" />
        </>
    ),
    "chevrons-right": (
        <>
            <path d="M13 17l5-5-5-5" />
            <path d="M6 17l5-5-5-5" />
        </>
    ),
    "external-link": (
        <>
            <path d="M14 4h6v6" />
            <path d="M20 4l-9 9" />
            <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
        </>
    ),
    "id-card": (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8" cy="11" r="2" />
            <path d="M6 16c0-1.5 1-2.5 2-2.5s2 1 2 2.5" />
            <path d="M13 9h6M13 12.5h6M13 16h4" />
        </>
    ),
    /* --- New icons for SmartCare screens --- */
    camera: (
        <>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </>
    ),
    "qr-code": (
        <>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="5" y="5" width="3" height="3" />
            <rect x="16" y="5" width="3" height="3" />
            <rect x="5" y="16" width="3" height="3" />
            <path d="M14 14h3v3M14 17v3M17 14v3" />
        </>
    ),
    person: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </>
    ),
    fingerprint: (
        <>
            <path d="M2 11.5C2 6.25 6.7 2 12.5 2S23 6.25 23 11.5" />
            <path d="M5 11.5c0-3.87 3.36-7 7.5-7s7.5 3.13 7.5 7" />
            <path d="M8 11.5c0-2.21 2.01-4 4.5-4s4.5 1.79 4.5 4" />
            <path d="M11 11.5a1.5 1.5 0 0 1 3 0" />
            <path d="M12 13v8" />
        </>
    ),
    "wifi-off": (
        <>
            <path d="M2 2l20 20" />
            <path d="M8.5 8.5A8 8 0 0 0 4 12l8 9 1.7-1.9" />
            <path d="M20 12a8 8 0 0 0-5-3" />
            <path d="M12 12l8 9" />
        </>
    ),
    clipboard: (
        <>
            <path d="M8 3H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
            <rect x="8" y="1" width="8" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
        </>
    ),
    refresh: (
        <>
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </>
    ),
    "key": (
        <>
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M21 2l-9.6 9.6M15.5 7.5l3 3L21 9l-2-2" />
        </>
    ),
    "plus": (
        <>
            <path d="M12 5v14M5 12h14" />
        </>
    ),
    "edit": (
        <>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </>
    ),
    "trash": (
        <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </>
    ),
    "copy": (
        <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
    ),
    "link": (
        <>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
    ),
    "calendar": (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    "map-pin": (
        <>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </>
    ),
};

export default function Icon({ name, className }) {
    const path = paths[name];
    if (!path) return null;
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {path}
        </svg>
    );
}
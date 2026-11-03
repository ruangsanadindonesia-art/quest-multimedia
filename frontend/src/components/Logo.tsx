interface Props {
    /** Pixel size of the logo square. Defaults to 36. */
    size?: number;
}

export default function Logo({ size = 36 }: Props) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id="laju-logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: "#14b8a6", stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: "#22d3ee", stopOpacity: 1 }} />
                </linearGradient>
            </defs>
            <path d="M30 10 H65 L55 50 H20 Z" fill="url(#laju-logo-grad)" />
            <path d="M20 58 H85 L75 90 H10 Z" fill="url(#laju-logo-grad)" />
            <rect
                x="70"
                y="58"
                width="20"
                height="32"
                transform="skewX(-14)"
                fill="white"
                fillOpacity="0.1"
            />
        </svg>
    );
}

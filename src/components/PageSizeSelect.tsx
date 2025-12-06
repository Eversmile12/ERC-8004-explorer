"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageSizeSelectProps {
    currentSize: number;
    sizes: number[];
    /** Current URL params to preserve when changing page size */
    currentParams: Record<string, string | undefined>;
}

export function PageSizeSelect({ currentSize, sizes, currentParams }: PageSizeSelectProps) {
    const router = useRouter();

    const handleChange = (newSize: number) => {
        const params = new URLSearchParams();
        Object.entries(currentParams).forEach(([key, value]) => {
            if (key === "perPage") {
                // Only add perPage if not default (24)
                if (newSize !== 24) params.set("perPage", String(newSize));
            } else if (key === "page") {
                // Reset to page 1 when changing size
                // Don't add page=1 to URL
            } else if (value) {
                params.set(key, value);
            }
        });
        const query = params.toString();
        router.push(query ? `/?${query}` : "/");
    };

    return (
        <div className="relative">
            <select
                value={currentSize}
                onChange={(e) => handleChange(parseInt(e.target.value))}
                className="appearance-none rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-8 text-sm text-white/70 outline-none focus:border-white/20"
            >
                {sizes.map((size) => (
                    <option key={size} value={size} className="bg-[#0a0a0b]">
                        {size}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        </div>
    );
}


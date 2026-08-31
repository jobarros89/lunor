"use client";

import { useEffect, useMemo, useState } from "react";
import { makeQrMatrix } from "@/lib/qr";

const PROD_ORIGIN = "https://lunorservice.com";

function pickupUrl(origin: string, token: string) {
  const preferred = `${origin.replace(/\/$/, "")}/q/${token}`;
  return new TextEncoder().encode(preferred).length <= 78
    ? preferred
    : `${PROD_ORIGIN}/q/${token}`;
}

export function PickupQr({ token, compact = false }: { token: string; compact?: boolean }) {
  const [origin, setOrigin] = useState(PROD_ORIGIN);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const value = useMemo(() => pickupUrl(origin, token), [origin, token]);
  const matrix = useMemo(() => makeQrMatrix(value), [value]);
  const quiet = 4;
  const size = matrix.length + quiet * 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={compact ? "size-36 bg-white p-2" : "size-52 bg-white p-3"}
        shapeRendering="crispEdges"
        role="img"
        aria-label="QR Code para retirada no Kids"
      >
        <rect width={size} height={size} fill="white" />
        {matrix.flatMap((row, y) =>
          row.map((dark, x) =>
            dark ? (
              <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="black" />
            ) : null
          )
        )}
      </svg>
      {!compact && (
        <p className="max-w-60 text-center text-xs text-muted-foreground">
          Leia com a câmera do celular. O QR identifica o check-in, mas não substitui a confirmação do responsável autorizado.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface HasikAdBannerProps {
  label: string;
}

export function HasikAdBanner({ label }: HasikAdBannerProps) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기나 로컬 미리보기에서는 준비 영역을 그대로 유지합니다.
    }
  }, []);

  return (
    <section className="hasik-ad-banner" aria-label={label}>
      <ins
        className="adsbygoogle hasik-ad-unit"
        style={{ display: "block" }}
        data-ad-client="ca-pub-6614664375260186"
        data-ad-slot="3996437949"
      />
      <span className="hasik-ad-placeholder" aria-hidden="true">
        광고 준비 중
      </span>
    </section>
  );
}

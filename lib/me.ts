"use client";
import { useEffect, useState } from "react";

export type Me = { id: string; name: string; role: "distributor" | "leader"; ready: boolean };

export function useMe(): Me {
  const [me, setMe] = useState<Me>({ id: "", name: "", role: "distributor", ready: false });
  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((j) => setMe({ id: j?.id ?? "", name: j?.name ?? "", role: j?.role === "leader" ? "leader" : "distributor", ready: true }))
      .catch(() => setMe((m) => ({ ...m, ready: true })));
  }, []);
  return me;
}

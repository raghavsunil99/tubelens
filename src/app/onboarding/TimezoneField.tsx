"use client";

import { useEffect, useState } from "react";

/** Sends the browser's timezone with the form, so "your Tuesday uploads" means the creator's Tuesday. */
export function TimezoneField() {
  const [tz, setTz] = useState("");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return <input type="hidden" name="timezone" value={tz} />;
}

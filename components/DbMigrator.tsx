"use client";

import { useEffect } from "react";

export default function DbMigrator() {
  useEffect(() => {
    fetch('/api/fix-test').then(res => res.json()).then(console.log).catch(console.error);
  }, []);
  return null;
}

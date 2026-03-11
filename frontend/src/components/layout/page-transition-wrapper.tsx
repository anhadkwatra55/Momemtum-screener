"use client";

import React from "react";

/**
 * PageTransitionWrapper — wraps children with a simple container
 * for potential page transitions. Currently passes children through.
 */
export function PageTransitionWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

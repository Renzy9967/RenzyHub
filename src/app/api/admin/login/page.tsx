import type { Metadata } from "next";
import AdminPanel from "./AdminPanel";

export const metadata: Metadata = {
  title: "RenzyHub Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <main className="container"><AdminPanel /></main>;
}

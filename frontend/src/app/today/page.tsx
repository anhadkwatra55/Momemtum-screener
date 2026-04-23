import { redirect } from "next/navigation";

export default function TodayPage() {
  redirect("/dashboard?view=today");
}

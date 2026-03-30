import { redirect } from "next/navigation";

export default function CaptainJoinPage() {
  redirect("/register?role=captain");
}

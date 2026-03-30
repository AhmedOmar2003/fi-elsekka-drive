import Link from "next/link";
import { notFound } from "next/navigation";

import { SupportReplyForm } from "@/components/admin-dashboard/actions";
import { SectionCard, StatusBadge } from "@/components/admin-dashboard/primitives";
import { fetchSupportTicketDetail } from "@/lib/admin-dashboard-data";

type Params = Promise<{ id: string }>;

export default async function AdminSupportTicketDetailsPage({ params }: { params: Params }) {
    const { id } = await params;
    const detail = await fetchSupportTicketDetail(id);

    if (!detail || !detail.ticket) notFound();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/admin/support" className="text-sm text-primary">
                    Back to support
                </Link>
                <h1 className="mt-2 text-3xl font-black">{detail.ticket.subject}</h1>
            </div>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <SectionCard title="Ticket information" subtitle="Owner, category, and linked trip">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">User</p>
                            <p className="mt-3 font-semibold">{detail.ticket.userName}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Status</p>
                            <div className="mt-3">
                                <StatusBadge status={detail.ticket.status} />
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Category</p>
                            <p className="mt-3 text-sm text-white/75">{detail.ticket.category}</p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Trip link</p>
                            <p className="mt-3 text-sm text-white/75">{detail.ticket.tripId ? <Link href={`/admin/trips/${detail.ticket.tripId}`} className="text-primary">{detail.ticket.tripId.slice(0, 8)}</Link> : "No trip linked"}</p>
                        </div>
                    </div>
                    <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Original complaint</p>
                        <p className="mt-3 text-sm leading-7 text-white/75">{detail.ticket.description}</p>
                    </div>
                </SectionCard>

                <SupportReplyForm ticketId={detail.ticket.id} />
            </section>

            <SectionCard title="Conversation thread" subtitle="Messages and internal replies for this ticket">
                <div className="space-y-4">
                    {detail.messages.map((message) => (
                        <div key={message.id} className="rounded-[28px] border border-white/10 bg-white/[0.025] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold">{message.senderName}</p>
                                    <p className="mt-1 text-xs text-white/45">{new Date(message.createdAt).toLocaleString("en-GB")}</p>
                                </div>
                                <StatusBadge status={message.isInternal ? "internal" : "active"} />
                            </div>
                            <p className="mt-4 text-sm leading-7 text-white/75">{message.messageBody}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
}

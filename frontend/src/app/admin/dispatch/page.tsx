import { DispatchBoardLive } from "@/components/admin-dashboard/dispatch-board-live";
import { fetchDispatchBoard } from "@/lib/admin-dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDispatchPage() {
    const board = await fetchDispatchBoard();

    return <DispatchBoardLive initialBoard={board} />;
}

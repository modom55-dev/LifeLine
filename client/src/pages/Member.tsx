import { Printer, ArrowLeft, LockKeyhole, LogOut, HeartHandshake } from "lucide-react";
import { useLocation } from "wouter";
import ChurchReference from "@/components/ChurchReference";
import Brand from "@/components/Brand";
import BulletinView from "@/components/BulletinView";
import ConnectionCardForm from "@/components/ConnectionCardForm";
import { NewsletterButton } from "@/components/Actions";
import { trpc } from "@/lib/trpc";
import Access, { LoadingState, ErrorState } from "./Access";

export default function Member() {
  const [, navigate] = useLocation();
  const status = trpc.pilot.status.useQuery();
  const data = trpc.bulletin.member.useQuery(undefined, {
    enabled: !!status.data?.hasMemberAccess,
  });
  const utils = trpc.useUtils();
  const leave = trpc.pilot.leave.useMutation({
    onSuccess: async () => {
      await utils.pilot.status.invalidate();
      utils.bulletin.member.reset();
      navigate("/access");
    },
  });
  if (status.isLoading) return <LoadingState />;
  if (status.error)
    return (
      <ErrorState
        message={status.error.message}
        retry={() => status.refetch()}
      />
    );
  if (!status.data?.hasMemberAccess) return <Access />;
  if (data.isLoading) return <LoadingState />;
  if (data.error)
    return (
      <ErrorState message={data.error.message} retry={() => data.refetch()} />
    );
  const d = data.data;
  return (
    <div className="member-page">
      <header className="member-header no-print">
        <Brand />
        <div className="member-header-actions">
          {status.data.isOwner ? (
            <button className="text-button" onClick={() => navigate("/admin")}>
              <ArrowLeft size={16} /> Owner workspace
            </button>
          ) : status.data.launched ? (
            <a className="text-button" href="#connect">
              <HeartHandshake size={16} /> Connection Card
            </a>
          ) : (
            <button
              className="text-button"
              onClick={() => leave.mutate()}
              disabled={leave.isPending}
            >
              <LogOut size={16} /> Leave pilot
            </button>
          )}
          {!status.data.launched && (
            <span className="pilot-chip">
              <LockKeyhole size={12} /> PRIVATE PILOT
            </span>
          )}
        </div>
      </header>
      <main className="member-main">
        {d?.bulletin ? (
          <>
            <div className="member-toolbar no-print">
              <span className="eyebrow">YOUR WEEKLY BULLETIN</span>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={16} /> Print bulletin
                </button>
                <NewsletterButton bulletin={d.bulletin} church={d.church} />
              </div>
            </div>
            <BulletinView bulletin={d.bulletin} church={d.church} notes />
            <ConnectionCardForm />
            <ChurchReference />
          </>
        ) : (
          <section className="empty-state">
            <h1>Sunday is on its way.</h1>
            <p>
              The church owner hasn’t published a bulletin yet. Check back soon.
            </p>
            <button className="button secondary" onClick={() => data.refetch()}>
              Check again
            </button>
          </section>
        )}
      </main>
      <footer className="member-page-footer no-print">
        Made for community. Built with care.{" "}
        <span>LifeLine · Powered by The O Factor</span>
      </footer>
    </div>
  );
}

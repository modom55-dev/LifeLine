import { useState } from "react";
import { toast } from "sonner";
import { Copy, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Bulletin, ChurchInfo } from "@shared/bulletin";
import { newsletter } from "@shared/bulletin";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    return true;
  } catch {
    toast.error("Clipboard unavailable. Select and copy the text manually.");
    return false;
  }
}
export function Modal({
  title,
  description,
  children,
  open,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="cc-dialog" showCloseButton={false}>
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
        <DialogTitle className="modal-title">{title}</DialogTitle>
        <DialogDescription className="muted">
          {description || "LifeLine pilot"}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function NewsletterButton({
  bulletin,
  church,
}: {
  bulletin: Bulletin;
  church: ChurchInfo;
}) {
  const [open, setOpen] = useState(false);
  const text = newsletter(bulletin, church);
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Copy size={16} /> Newsletter
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="A newsletter, ready to share"
        description="Plain text from this bulletin. Nothing is emailed by LifeLine."
      >
        <textarea
          className="newsletter-text"
          aria-label="Newsletter text"
          value={text}
          readOnly
        />
        <button className="button primary" onClick={() => copyText(text)}>
          <Copy size={16} /> Copy newsletter
        </button>
      </Modal>
    </>
  );
}

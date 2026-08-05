import AppShell from "@/components/AppShell";
import MavelyWizard from "@/components/MavelyWizard";

export default function NewMavelyProduct() {
  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">Mavely Affiliate Importer</div>
          <h1 className="title">Add affiliate product</h1>
          <div className="muted">Paste a retailer link and a Mavely link, then walk through the steps to publish.</div>
        </div>
      </div>
      <MavelyWizard />
    </AppShell>
  );
}

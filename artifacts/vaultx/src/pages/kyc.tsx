import { useState, useRef, useMemo } from "react";
import {
  Shield, Upload, CheckCircle, Clock, AlertTriangle, Camera, Search, ChevronDown, X,
} from "lucide-react";
import { useGetKycStatus, getGetKycStatusQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "driver_license", label: "Driver's License" },
  { value: "residence_permit", label: "Residence Permit" },
];

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia",
  "Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium",
  "Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei",
  "Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic",
  "Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba","Cyprus",
  "Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador",
  "Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos",
  "Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar",
  "Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico",
  "Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia",
  "Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia",
  "Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru",
  "Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Saudi Arabia","Senegal","Serbia",
  "Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa",
  "South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria",
  "Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago",
  "Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom",
  "United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen",
  "Zambia","Zimbabwe",
];

function CountrySelector({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  const handleSelect = (c: string) => {
    onChange(c);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-10 px-3 flex items-center justify-between rounded-md border text-sm transition-colors",
          open ? "border-primary ring-1 ring-primary/30" : "border-input hover:border-primary/40",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="truncate">{value || "Select your country"}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="p-0.5 rounded hover:bg-muted"
            >
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
          <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search countries…"
                className="w-full h-9 pl-8 pr-3 text-sm bg-muted/50 border border-transparent rounded-lg focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No countries found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-primary/5 transition-colors",
                    value === c && "bg-primary/8 font-medium text-primary",
                  )}
                >
                  {c}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ImageUploadBox({
  label, hint, badge, value, onChange,
}: {
  label: string; hint: string; badge?: string; value: string | null; onChange: (v: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        {badge && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{badge}</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{hint}</p>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-border aspect-[3/2] shadow-sm">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X size={12} />
          </button>
          <div className="absolute bottom-2 left-2 bg-emerald-500 rounded-full p-1 shadow">
            <CheckCircle size={12} className="text-white" />
          </div>
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="w-full aspect-[3/2] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2.5 hover:border-primary/50 hover:bg-primary/3 transition-all active:scale-[0.99]"
        >
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Camera size={20} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Tap to upload</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">JPG or PNG · Max 5 MB</p>
          </div>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFile(e.target.files[0]);
        }}
      />
    </div>
  );
}

export default function KycPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [fullLegalName, setFullLegalName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [country, setCountry] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  const { data: kycStatus, isLoading } = useGetKycStatus({
    query: { queryKey: getGetKycStatusQueryKey(), staleTime: 30000 },
  });

  const handleSubmit = async () => {
    if (!documentType || !fullLegalName || !documentNumber || !country || !frontImage || !selfieImage) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields and upload your ID front + selfie",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          fullLegalName,
          documentNumber,
          country,
          frontImageUrl: frontImage,
          backImageUrl: backImage || undefined,
          selfieUrl: selfieImage,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Submission failed");
      }
      toast({ title: "KYC Submitted!", description: "We'll review your documents within 24–48 hours" });
      queryClient.invalidateQueries({ queryKey: getGetKycStatusQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Identity Verification">
        <div className="px-4 pt-5 space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  const status = (kycStatus as any)?.status ?? "none";

  if (status === "approved") {
    return (
      <AppLayout title="Identity Verification">
        <div className="px-4 pt-8 pb-24 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <CheckCircle size={36} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Verified!</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Your identity has been successfully verified. Your account has full access.
          </p>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-6 text-left space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Document type</p>
              <p className="text-sm font-semibold capitalize mt-0.5">
                {(kycStatus as any)?.documentType?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Verified on</p>
              <p className="text-sm font-semibold mt-0.5">
                {(kycStatus as any)?.reviewedAt ? formatDate((kycStatus as any).reviewedAt) : "—"}
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (status === "pending") {
    return (
      <AppLayout title="Identity Verification">
        <div className="px-4 pt-8 pb-24 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Clock size={36} className="text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Under Review</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Your documents are being reviewed. This typically takes 24–48 hours.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mt-6 text-left space-y-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Submitted</p>
              <p className="text-sm font-semibold mt-0.5">
                {(kycStatus as any)?.submittedAt ? formatDate((kycStatus as any).submittedAt) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Document</p>
              <p className="text-sm font-semibold capitalize mt-0.5">
                {(kycStatus as any)?.documentType?.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canSubmit =
    !submitting && documentType && fullLegalName && documentNumber && country && frontImage && selfieImage;

  return (
    <AppLayout title="Identity Verification">
      <div className="px-4 pt-5 pb-28 space-y-4">

        {/* Header banner */}
        <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex gap-3 items-start">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Verify Your Identity</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete KYC to unlock higher withdrawal limits and full account features.
            </p>
          </div>
        </div>

        {/* Rejection notice */}
        {status === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-2.5">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Previous submission rejected</p>
              <p className="text-xs text-red-600 mt-0.5">
                {(kycStatus as any)?.rejectionReason ?? "Please resubmit with clearer, well-lit images."}
              </p>
            </div>
          </div>
        )}

        {/* Upload instructions */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-sm text-foreground mb-3">Photo Guidelines</h3>
          <div className="space-y-2">
            {[
              "Ensure all four corners of the document are visible",
              "Use good lighting — avoid shadows and glare",
              "Images must be sharp and in focus",
              "For selfie: hold the document next to your face clearly",
              "Do not use screenshots or photocopies",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-xs text-muted-foreground">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Personal information */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3.5">
          <h3 className="font-semibold text-sm text-foreground">Personal Information</h3>
          <div>
            <Label className="text-sm font-medium">
              Full Legal Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={fullLegalName}
              onChange={(e) => setFullLegalName(e.target.value)}
              placeholder="As it appears on your ID"
              className="mt-1.5 h-10"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">
              Country <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1.5">
              <CountrySelector value={country} onChange={setCountry} />
            </div>
          </div>
        </div>

        {/* Document details */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3.5">
          <h3 className="font-semibold text-sm text-foreground">Document Details</h3>
          <div>
            <Label className="text-sm font-medium">
              Document Type <span className="text-destructive">*</span>
            </Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger className="mt-1.5 h-10">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">
              Document Number <span className="text-destructive">*</span>
            </Label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Enter your document number"
              className="mt-1.5 h-10"
            />
          </div>
        </div>

        {/* Document images */}
        <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-5">
          <h3 className="font-semibold text-sm text-foreground">Document Images</h3>
          <ImageUploadBox
            label="Front of Document"
            hint="Clear photo of the front side of your ID document"
            badge="Required"
            value={frontImage}
            onChange={setFrontImage}
          />
          <ImageUploadBox
            label="Back of Document"
            hint="Clear photo of the back side (required for national ID cards)"
            badge="Optional"
            value={backImage}
            onChange={setBackImage}
          />
          <ImageUploadBox
            label="Selfie with Document"
            hint="Hold your ID next to your face — both must be clearly visible"
            badge="Required"
            value={selfieImage}
            onChange={setSelfieImage}
          />
        </div>

        {/* Submit button */}
        <Button
          className="w-full h-12 text-sm font-semibold rounded-xl shadow-sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Submitting…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Upload size={15} />
              Submit for Verification
            </span>
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center pb-2">
          Your documents are encrypted and processed securely. We never share your personal data.
        </p>
      </div>
    </AppLayout>
  );
}

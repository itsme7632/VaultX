import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, User, Mail, Phone, Lock, Hash, ArrowRight, ChevronDown, Globe, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useSignup, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  { code: "AF", name: "Afghanistan", dial: "+93" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "AD", name: "Andorra", dial: "+376" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "AG", name: "Antigua & Barbuda", dial: "+1268" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "AM", name: "Armenia", dial: "+374" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "AZ", name: "Azerbaijan", dial: "+994" },
  { code: "BS", name: "Bahamas", dial: "+1242" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "BB", name: "Barbados", dial: "+1246" },
  { code: "BY", name: "Belarus", dial: "+375" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "BZ", name: "Belize", dial: "+501" },
  { code: "BJ", name: "Benin", dial: "+229" },
  { code: "BT", name: "Bhutan", dial: "+975" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "BA", name: "Bosnia & Herzegovina", dial: "+387" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "BN", name: "Brunei", dial: "+673" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "BI", name: "Burundi", dial: "+257" },
  { code: "CV", name: "Cabo Verde", dial: "+238" },
  { code: "KH", name: "Cambodia", dial: "+855" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "CF", name: "Central African Republic", dial: "+236" },
  { code: "TD", name: "Chad", dial: "+235" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "KM", name: "Comoros", dial: "+269" },
  { code: "CD", name: "Congo (DRC)", dial: "+243" },
  { code: "CG", name: "Congo (Republic)", dial: "+242" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "CU", name: "Cuba", dial: "+53" },
  { code: "CY", name: "Cyprus", dial: "+357" },
  { code: "CZ", name: "Czech Republic", dial: "+420" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "DJ", name: "Djibouti", dial: "+253" },
  { code: "DO", name: "Dominican Republic", dial: "+1809" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "GQ", name: "Equatorial Guinea", dial: "+240" },
  { code: "ER", name: "Eritrea", dial: "+291" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "SZ", name: "Eswatini", dial: "+268" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "FJ", name: "Fiji", dial: "+679" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "GA", name: "Gabon", dial: "+241" },
  { code: "GM", name: "Gambia", dial: "+220" },
  { code: "GE", name: "Georgia", dial: "+995" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "GN", name: "Guinea", dial: "+224" },
  { code: "GW", name: "Guinea-Bissau", dial: "+245" },
  { code: "GY", name: "Guyana", dial: "+592" },
  { code: "HT", name: "Haiti", dial: "+509" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "IS", name: "Iceland", dial: "+354" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "IR", name: "Iran", dial: "+98" },
  { code: "IQ", name: "Iraq", dial: "+964" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "JM", name: "Jamaica", dial: "+1876" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "KZ", name: "Kazakhstan", dial: "+7" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "KG", name: "Kyrgyzstan", dial: "+996" },
  { code: "LA", name: "Laos", dial: "+856" },
  { code: "LV", name: "Latvia", dial: "+371" },
  { code: "LB", name: "Lebanon", dial: "+961" },
  { code: "LS", name: "Lesotho", dial: "+266" },
  { code: "LR", name: "Liberia", dial: "+231" },
  { code: "LY", name: "Libya", dial: "+218" },
  { code: "LI", name: "Liechtenstein", dial: "+423" },
  { code: "LT", name: "Lithuania", dial: "+370" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MG", name: "Madagascar", dial: "+261" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "MV", name: "Maldives", dial: "+960" },
  { code: "ML", name: "Mali", dial: "+223" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "MR", name: "Mauritania", dial: "+222" },
  { code: "MU", name: "Mauritius", dial: "+230" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "MD", name: "Moldova", dial: "+373" },
  { code: "MN", name: "Mongolia", dial: "+976" },
  { code: "ME", name: "Montenegro", dial: "+382" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "MZ", name: "Mozambique", dial: "+258" },
  { code: "MM", name: "Myanmar", dial: "+95" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "NE", name: "Niger", dial: "+227" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "PA", name: "Panama", dial: "+507" },
  { code: "PG", name: "Papua New Guinea", dial: "+675" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "PE", name: "Peru", dial: "+51" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "RU", name: "Russia", dial: "+7" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "RS", name: "Serbia", dial: "+381" },
  { code: "SL", name: "Sierra Leone", dial: "+232" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "SK", name: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "SO", name: "Somalia", dial: "+252" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "SS", name: "South Sudan", dial: "+211" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "SD", name: "Sudan", dial: "+249" },
  { code: "SR", name: "Suriname", dial: "+597" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "SY", name: "Syria", dial: "+963" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "TJ", name: "Tajikistan", dial: "+992" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "TT", name: "Trinidad & Tobago", dial: "+1868" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "TM", name: "Turkmenistan", dial: "+993" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "UZ", name: "Uzbekistan", dial: "+998" },
  { code: "VU", name: "Vanuatu", dial: "+678" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "YE", name: "Yemen", dial: "+967" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
];

const schema = z
  .object({
    fullName: z.string().min(1, "Full name is required").min(2, "Full name must be at least 2 characters"),
    username: z
      .string()
      .min(1, "Username is required")
      .min(3, "At least 3 characters")
      .regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscores only"),
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Enter a valid email address"),
    country: z.string().min(1, "Select your country"),
    dialCode: z.string().optional(),
    whatsapp: z
      .string()
      .min(1, "WhatsApp number is required")
      .min(5, "Enter a valid WhatsApp number"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    referralCode: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-destructive", "bg-amber-400", "bg-yellow-400", "bg-accent"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300", i <= strength ? colors[strength] : "bg-muted")} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{labels[strength]} password</p>
    </div>
  );
}

function UsernameIndicator({ status }: { status: UsernameStatus }) {
  if (status === "idle") return null;
  if (status === "checking") return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <Loader2 size={12} className="animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Checking availability…</span>
    </div>
  );
  if (status === "available") return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <CheckCircle2 size={13} className="text-emerald-500" />
      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Username available</span>
    </div>
  );
  if (status === "taken") return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <XCircle size={13} className="text-destructive" />
      <span className="text-xs text-destructive font-medium">Username already taken</span>
    </div>
  );
  return null;
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const signup = useSignup();

  const refFromUrl    = new URLSearchParams(window.location.search).get("ref") ?? "";
  const sourceFromUrl = new URLSearchParams(window.location.search).get("source") ?? "direct";

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      country: "",
      dialCode: "+1",
      whatsapp: "",
      password: "",
      confirmPassword: "",
      referralCode: refFromUrl.toUpperCase(),
    },
  });

  const password = form.watch("password");
  const selectedCountry = form.watch("country");
  const dialCode = form.watch("dialCode");
  const usernameValue = form.watch("username");

  // Real-time username availability check
  useEffect(() => {
    const username = usernameValue?.trim();
    if (!username || username.length < 3 || !/^[a-z0-9_]+$/i.test(username)) {
      setUsernameStatus("idle");
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
      return;
    }
    setUsernameStatus("checking");
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`, { credentials: "include" });
        if (!res.ok) { setUsernameStatus("idle"); return; }
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 450);
    return () => { if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current); };
  }, [usernameValue]);

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch)
  );

  const onSubmit = (data: FormData) => {
    if (usernameStatus === "taken") {
      toast({ title: "Username taken", description: "Please choose a different username.", variant: "destructive" });
      return;
    }
    const whatsappFull = `${data.dialCode ?? ""}${data.whatsapp.replace(/^0+/, "")}`;
    signup.mutate(
      { data: { ...data, whatsapp: whatsappFull, referralSource: sourceFromUrl } },
      {
        onSuccess: (data: any) => {
          if (data?.requiresVerification && data?.email) {
            setLocation(`/verify-email?email=${encodeURIComponent(data.email)}`);
          } else {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setLocation("/");
          }
        },
        onError: (err: any) => {
          toast({ title: "Signup failed", description: err?.message || "Something went wrong", variant: "destructive" });
        },
      }
    );
  };

  const isSubmitDisabled = signup.isPending || usernameStatus === "taken" || usernameStatus === "checking";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/wx-logo.png" alt="Wexora" className="w-12 h-12 rounded-2xl mx-auto mb-3 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-foreground">Create account</h1>
          <p className="text-muted-foreground mt-1 text-sm">Join Wexora today</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Full name */}
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input {...field} placeholder="John Doe" className="pl-9 h-10 bg-muted/40" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Username + Email */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="username" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="johndoe"
                          className={cn(
                            "pl-9 h-10 bg-muted/40",
                            usernameStatus === "available" && "border-emerald-500 focus-visible:ring-emerald-500",
                            usernameStatus === "taken" && "border-destructive focus-visible:ring-destructive",
                          )}
                        />
                      </div>
                    </FormControl>
                    <UsernameIndicator status={usernameStatus} />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} type="email" placeholder="you@email.com" className="pl-9 h-10 bg-muted/40" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Country selector */}
              <FormField control={form.control} name="country" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Country</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDrop(!showCountryDrop)}
                        className="w-full h-10 bg-muted/40 border border-input rounded-md flex items-center gap-2 px-3 text-sm text-left"
                      >
                        <Globe size={14} className="text-muted-foreground shrink-0" />
                        <span className={cn("flex-1 truncate", !field.value && "text-muted-foreground")}>
                          {field.value
                            ? COUNTRIES.find((c) => c.name === field.value)?.name ?? field.value
                            : "Select country"}
                        </span>
                        <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                      </button>
                      {showCountryDrop && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
                          <div className="p-2 border-b border-border">
                            <Input
                              autoFocus
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              placeholder="Search country..."
                              className="h-8 text-sm bg-muted/40"
                            />
                          </div>
                          <div className="overflow-y-auto max-h-44">
                            {filteredCountries.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  field.onChange(c.name);
                                  form.setValue("dialCode", c.dial);
                                  setShowCountryDrop(false);
                                  setCountrySearch("");
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 text-left"
                              >
                                <span className="text-muted-foreground text-xs w-10 shrink-0">{c.dial}</span>
                                <span className="truncate text-foreground">{c.name}</span>
                              </button>
                            ))}
                            {!filteredCountries.length && (
                              <p className="text-center text-xs text-muted-foreground py-4">No countries found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* WhatsApp with dial code — REQUIRED */}
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    WhatsApp Number <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-1.5">
                      <div className="h-10 bg-muted/40 border border-input rounded-md flex items-center px-2.5 text-sm font-mono text-muted-foreground shrink-0 min-w-[60px]">
                        {dialCode || "+1"}
                      </div>
                      <div className="relative flex-1">
                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} placeholder="7001234567" className="pl-8 h-10 bg-muted/40" />
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-[11px] text-muted-foreground mt-1">Required for account support and verification</p>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        className="pl-9 pr-10 h-10 bg-muted/40"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </FormControl>
                  <PasswordStrength password={password} />
                  <FormMessage />
                </FormItem>
              )} />

              {/* Confirm password */}
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input {...field} type="password" placeholder="Repeat password" className="pl-9 h-10 bg-muted/40" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Referral code */}
              <FormField control={form.control} name="referralCode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-muted-foreground">Referral Code <span className="font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="XXXXXXXX" className="h-10 bg-muted/40 uppercase" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Username taken warning banner */}
              {usernameStatus === "taken" && (
                <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <XCircle size={14} className="text-destructive shrink-0" />
                  <p className="text-xs text-destructive font-medium">Choose a different username to continue</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm mt-2"
                disabled={isSubmitDisabled}
              >
                {signup.isPending ? "Creating account..." : usernameStatus === "checking" ? (
                  <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Checking…</span>
                ) : (
                  <span className="flex items-center gap-2">Create account <ArrowRight size={16} /></span>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

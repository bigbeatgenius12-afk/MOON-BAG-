import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Rocket, AlertTriangle, ImagePlus } from "lucide-react";
import { useCreateLaunchedCoin, useGetLaunchedCoinStats, requestUploadUrl } from "@workspace/api-client-react";
import { Card, Button, Input, Textarea, Label } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { payLaunchFee, LAUNCH_FEE_MGOAT } from "@/lib/launch-fee";
import { Link } from "wouter";

const launchSchema = z.object({
  name: z.string().min(1, "Name is required").max(64),
  ticker: z.string().min(1, "Ticker is required").max(10).toUpperCase(),
  description: z.string().min(10, "Description is too short"),
  image_url: z.string().optional().or(z.literal("")),
  creator_name: z.string().min(1, "Creator name required"),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  initial_supply: z.coerce.number().min(1000, "Minimum 1000 supply"),
});

type LaunchFormValues = z.infer<typeof launchSchema>;

const SUPPLY_PRESETS = [
  { label: "1 Million", value: 1_000_000 },
  { label: "100 Million", value: 100_000_000 },
  { label: "1 Billion", value: 1_000_000_000 },
  { label: "1 Trillion", value: 1_000_000_000_000 },
];

export default function LaunchPage() {
  const [, setLocation] = useLocation();
  const { data: stats } = useGetLaunchedCoinStats();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      form.setValue("image_url", `/api/storage${objectPath}`);
      setPreview(URL.createObjectURL(file));
    } catch {
      setUploadError("Photo upload failed — try again.");
    } finally {
      setUploading(false);
    }
  };
  
  const form = useForm<LaunchFormValues>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      name: "",
      ticker: "",
      description: "",
      image_url: "",
      creator_name: "",
      website: "",
      twitter: "",
      telegram: "",
      initial_supply: 1000000000,
    }
  });

  const createCoin = useCreateLaunchedCoin();
  const { traderName } = useWallet();
  const [feeError, setFeeError] = useState<{ held: number; mgoatId: number } | null>(null);
  const [feeFailMsg, setFeeFailMsg] = useState("");
  const [payingFee, setPayingFee] = useState(false);

  const onSubmit = async (data: LaunchFormValues) => {
    setFeeError(null);
    setFeeFailMsg("");
    setPayingFee(true);
    try {
      const fee = await payLaunchFee(traderName || "you");
      if (!fee.ok) {
        if (fee.reason === "insufficient") setFeeError({ held: fee.held, mgoatId: fee.mgoatId });
        else setFeeFailMsg("MGOAT market unavailable — try again in a moment.");
        return;
      }
    } catch {
      setFeeFailMsg("Could not charge the launch fee — try again.");
      return;
    } finally {
      setPayingFee(false);
    }
    createCoin.mutate({ data }, {
      onSuccess: (result) => {
        setLocation(`/launched/${result.id}`);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      
      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-primary/20 bg-primary/5 text-center">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Launched</div>
          <div className="text-2xl font-mono text-primary font-bold">{stats ? formatNumber(stats.total_coins_launched) : "-"}</div>
        </div>
        <div className="p-4 border border-border bg-card/30 text-center">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Launched Today</div>
          <div className="text-2xl font-mono font-bold">{stats ? stats.coins_launched_today : "-"}</div>
        </div>
        <div className="p-4 border border-border bg-card/30 text-center">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Total Vol (24H)</div>
          <div className="text-2xl font-mono font-bold">${stats ? formatNumber(stats.total_volume) : "-"}</div>
        </div>
        <div className="p-4 border border-border bg-card/30 text-center">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Active Degens</div>
          <div className="text-2xl font-mono font-bold">{stats ? formatNumber(stats.total_traders) : "-"}</div>
        </div>
      </div>

      <Card className="p-8 border-primary/30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">Deploy Payload</h1>
          <p className="text-muted-foreground font-mono text-sm">Launch a new contract to the network. 100% fair launch.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Token Name *</Label>
              <Input {...form.register("name")} placeholder="E.g. Moon Bag Token" />
              {form.formState.errors.name && <p className="text-destructive text-xs font-mono">{form.formState.errors.name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Ticker Symbol *</Label>
              <Input {...form.register("ticker")} placeholder="E.g. MBAG" className="uppercase" />
              {form.formState.errors.ticker && <p className="text-destructive text-xs font-mono">{form.formState.errors.ticker.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea {...form.register("description")} placeholder="What's the narrative? Why will this moon?" className="h-24" />
            {form.formState.errors.description && <p className="text-destructive text-xs font-mono">{form.formState.errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Coin Photo</Label>
              <label className="flex items-center gap-3 border border-dashed border-border hover:border-primary/60 transition-colors cursor-pointer p-3">
                {preview ? (
                  <img src={preview} alt="Coin" className="w-12 h-12 object-cover border border-primary/40" />
                ) : (
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="text-xs font-mono text-muted-foreground">
                  {uploading ? "UPLOADING..." : preview ? "PHOTO READY — CLICK TO CHANGE" : "UPLOAD A PHOTO (PNG/JPG)"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
              </label>
              {uploadError && <p className="text-destructive text-xs font-mono">{uploadError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Creator Pseudonym *</Label>
              <Input {...form.register("creator_name")} placeholder="anon123" />
              {form.formState.errors.creator_name && <p className="text-destructive text-xs font-mono">{form.formState.errors.creator_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Website (Optional)</Label>
              <Input {...form.register("website")} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Twitter (Optional)</Label>
              <Input {...form.register("twitter")} placeholder="@handle" />
            </div>
            <div className="space-y-2">
              <Label>Telegram (Optional)</Label>
              <Input {...form.register("telegram")} placeholder="t.me/..." />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Starting Supply * <span className="text-muted-foreground font-normal">(how many coins exist at launch)</span></Label>
            <div className="flex flex-wrap gap-2">
              {SUPPLY_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => form.setValue("initial_supply", p.value, { shouldValidate: true })}
                  className={`px-3 py-1.5 text-xs font-mono uppercase border transition-colors ${
                    form.watch("initial_supply") === p.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Input type="number" {...form.register("initial_supply")} />
            {form.formState.errors.initial_supply && <p className="text-destructive text-xs font-mono">{form.formState.errors.initial_supply.message}</p>}
          </div>

          <div className="p-4 border border-primary/30 bg-primary/5 font-mono text-xs flex items-center justify-between gap-3">
            <span className="uppercase tracking-widest text-muted-foreground">Launch fee</span>
            <span className="font-bold text-primary">{formatNumber(LAUNCH_FEE_MGOAT)} MGOAT</span>
          </div>
          {feeFailMsg && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 font-mono text-xs">
              <p className="text-destructive font-bold uppercase">{feeFailMsg}</p>
            </div>
          )}
          {feeError && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 font-mono text-xs space-y-1">
              <p className="text-destructive font-bold uppercase">Not enough MGOAT</p>
              <p className="text-muted-foreground">
                You hold {formatNumber(feeError.held)} MGOAT but launching costs {formatNumber(LAUNCH_FEE_MGOAT)}.{" "}
                <Link href={`/launched/${feeError.mgoatId}`} className="text-primary underline">Buy MGOAT here</Link> then come back.
              </p>
            </div>
          )}

          <div className="p-4 bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-destructive-foreground/80 leading-relaxed">
              WARNING: Launching a coin is immutable. Smart contracts cannot be altered once deployed. By clicking launch, you agree that you are fully responsible for this payload.
            </p>
          </div>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full text-lg h-14" 
            disabled={createCoin.isPending || payingFee}
          >
            {payingFee ? "CHARGING LAUNCH FEE..." : createCoin.isPending ? "INITIATING LAUNCH SEQUENCE..." : (
              <span className="flex items-center gap-2">
                <Rocket className="w-5 h-5" /> LAUNCH TO THE MOON
              </span>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

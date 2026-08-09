// components/auth/auth-modal.tsx

"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { LogIn, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthForm, type AuthMode } from "@/components/auth/auth-form";

type AuthModalProps = {
  triggerLabel?: string;
  callbackUrl?: string;
};

export function AuthModal({
  triggerLabel = "Connexion",
  callbackUrl = "/"
}: AuthModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMode("login");
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" className="gap-2 px-2.5 sm:px-4" title={triggerLabel}>
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">
                {mode === "login" ? "Connexion" : "Inscription"}
              </Dialog.Title>

              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Connecte-toi pour accéder à Disk Indexer."
                  : "Crée ton compte pour accéder à Disk Indexer."}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6">
            <AuthForm
              mode={mode}
              onModeChange={setMode}
              callbackUrl={callbackUrl}
              onSuccess={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

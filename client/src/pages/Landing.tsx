import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JJLogo } from "@/lib/logo";

export function Landing({ onStartIndividual }: { onStartIndividual: () => void }) {
  const [, setLocation] = useLocation();
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center"><JJLogo className="h-14 w-14" /></div>
          <h1 className="text-xl font-semibold tracking-tight" data-testid="text-landing-title">Jesus Journey Survey</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            A picture of where you are on your spiritual journey, and where your church community is together.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Take the survey for yourself</CardTitle>
              <CardDescription>No account or church code needed. Fully anonymous, nothing is saved after your report.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={onStartIndividual} data-testid="button-landing-individual">
                Start my survey
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Join your church's survey</CardTitle>
              <CardDescription>Enter the code your church shared with you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. 4X9K2"
                data-testid="input-landing-join-code"
              />
              <Button
                className="w-full"
                variant="outline"
                disabled={!joinCode.trim()}
                onClick={() => setLocation(`/join/${joinCode.trim()}`)}
                data-testid="button-landing-join"
              >
                Join survey
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <button
            className="text-sm text-muted-foreground underline underline-offset-2"
            onClick={() => setLocation("/church")}
            data-testid="link-landing-church-portal"
          >
            Church leader? Sign in or set up your survey
          </button>
        </div>
      </div>
    </div>
  );
}

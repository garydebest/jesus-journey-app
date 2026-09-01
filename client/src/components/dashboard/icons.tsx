import {
  Clock, TrendingUp, ListChecks, ClipboardList, Activity, FileStack,
  BarChart3, MessageSquare, BookOpen, Users, CalendarClock, NotebookPen,
  FolderDown, Image, Mic2,
} from "lucide-react";
import type { InfoCard, ResourceCard } from "@/lib/dashboardContent";

export function InfoCardIcon({ icon, className = "h-5 w-5" }: { icon: InfoCard["icon"]; className?: string }) {
  const map: Record<InfoCard["icon"], React.ComponentType<{ className?: string }>> = {
    understanding: Clock,
    steps: ListChecks,
    keys: TrendingUp,
    starting: ClipboardList,
    monitoring: Activity,
    paper: FileStack,
    report: BarChart3,
    comments: MessageSquare,
    resource: BookOpen,
  };
  const Icon = map[icon] ?? BookOpen;
  return <Icon className={className} />;
}

export function ResourceCardIcon({ icon, className = "h-6 w-6" }: { icon: ResourceCard["icon"]; className?: string }) {
  const map: Record<ResourceCard["icon"], React.ComponentType<{ className?: string }>> = {
    curriculum: FolderDown,
    graphics: Image,
    message: Mic2,
  };
  const Icon = map[icon] ?? FolderDown;
  return <Icon className={className} />;
}

export const ActStepMarkerIcon = CalendarClock;
export const UsersIcon = Users;
export const NoteIcon = NotebookPen;

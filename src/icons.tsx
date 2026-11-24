import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChatCircle,
  PaperPlaneRight,
  ArrowRight,
  ArrowUpRight,
  Books,
  Broadcast,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  Check,
  CircleNotch,
  DotsThree,
  Eyedropper,
  GearSix,
  Heart,
  MagnifyingGlass,
  MusicNotes,
  Pause,
  PencilSimple,
  Play,
  Plus,
  ShieldCheck,
  SignOut,
  SkipBack,
  SkipForward,
  Sparkle,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash,
  Tray,
  TrendDown,
  TrendUp,
  User,
  VinylRecord,
  X,
  XCircle,
  type Icon,
} from "@phosphor-icons/react";
import { t } from "./i18n";

const mk =
  (C: Icon, solid = false) =>
  () => <C className="ico" aria-hidden weight={solid ? "fill" : "bold"} />;
const directional = (C: Icon) => () => <C className="ico flip-rtl" aria-hidden weight="bold" />;

const DISCORD =
  "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z";

export const Ico = {
  Left: directional(ArrowLeft),
  Right: directional(ArrowRight),
  External: mk(ArrowUpRight),
  Check: mk(Check),
  Search: mk(MagnifyingGlass),
  XCircle: mk(XCircle, true),
  Chevron: directional(CaretRight),
  ChevLeft: directional(CaretLeft),
  ChevDown: mk(CaretDown),
  Calendar: mk(CalendarBlank, true),
  Eyedropper: mk(Eyedropper),
  Music: mk(MusicNotes, true),
  Star: mk(Star, true),
  Disc: mk(VinylRecord, true),
  Plus: mk(Plus),
  X: mk(X),
  Play: mk(Play, true),
  Pause: mk(Pause, true),
  Prev: mk(SkipBack, true),
  Next: mk(SkipForward, true),
  Up: mk(TrendUp),
  Down: mk(TrendDown),
  User: mk(User, true),
  Library: mk(Books, true),
  Reports: mk(ChartBar, true),
  Recommended: mk(Sparkle, true),
  Inbox: mk(Tray, true),
  Scrobble: mk(Broadcast, true),
  Settings: mk(GearSix, true),
  LogOut: mk(SignOut),
  Discord: () => (
    <svg className="ico" aria-hidden viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
      <path d={DISCORD} />
    </svg>
  ),
  More: mk(DotsThree),
  Edit: mk(PencilSimple),
  Delete: mk(Trash),
  Shield: mk(ShieldCheck, true),
  Chat: mk(ChatCircle, true),
  Send: mk(PaperPlaneRight, true),
  SortUp: mk(ArrowUp),
  SortDown: mk(ArrowDown),
  Heart: ({ on }: { on?: boolean }) => <Heart className="ico" aria-hidden weight={on ? "fill" : "bold"} />,
  ThumbsDown: ({ on }: { on?: boolean }) => <ThumbsDown className="ico" aria-hidden weight={on ? "fill" : "bold"} />,
  ThumbsUp: ({ on }: { on?: boolean }) => <ThumbsUp className="ico" aria-hidden weight={on ? "fill" : "bold"} />,
};

const srOnly = "absolute w-px h-px overflow-hidden [clip:rect(0_0_0_0)] [clip-path:inset(50%)] whitespace-nowrap";

/** An arrow between two words, as in "old > new". Screen readers hear `say`. */
export const Arrow = ({ say = t("common.arrowTo") }: { say?: string }) => (
  <span className="arrow">
    <ArrowRight className="ico flip-rtl" aria-hidden weight="bold" />
    <span className={srOnly}>{say}</span>
  </span>
);

const SEP = " → ";

/** Text with arrows in it (as staff action labels store renames and merges), the arrows drawn as icons. */
export const arrowed = (s: string | null) => {
  if (!s || !s.includes(SEP)) return s;
  return s.split(SEP).flatMap((p, i) => (i ? [<Arrow key={i} />, p] : [p]));
};

export const Spinner = ({ page }: { page?: boolean }) => (
  <div className={page ? "spinner page-spinner" : "spinner"} role="status" aria-label={t("common.loading")}>
    <CircleNotch aria-hidden weight="bold" />
  </div>
);

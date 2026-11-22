import { ArrowDown, ArrowLeft, ArrowUp, ChatCircle, PaperPlaneRight, ArrowRight, ArrowUpRight, Books, Broadcast, CalendarBlank, CaretDown, CaretLeft, CaretRight, ChartBar, Check, CircleNotch, DotsThree, GearSix, Heart, MagnifyingGlass, MusicNotes, Pause, Play, Plus, ShieldCheck, SignOut, SkipBack, SkipForward, Sparkle, Star, Tray, TrendDown, TrendUp, User, VinylRecord, X, XCircle, type Icon } from "@phosphor-icons/react";

const mk = (C: Icon, solid = false) => () => <C className="ico" aria-hidden weight={solid ? "fill" : "bold"} />;

export const Ico = {
  Left: mk(ArrowLeft),
  Right: mk(ArrowRight),
  External: mk(ArrowUpRight),
  Check: mk(Check),
  Search: mk(MagnifyingGlass),
  XCircle: mk(XCircle, true),
  Chevron: mk(CaretRight),
  ChevLeft: mk(CaretLeft),
  ChevDown: mk(CaretDown),
  Calendar: mk(CalendarBlank, true),
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
  More: mk(DotsThree),
  Shield: mk(ShieldCheck, true),
  Chat: mk(ChatCircle, true),
  Send: mk(PaperPlaneRight, true),
  SortUp: mk(ArrowUp),
  SortDown: mk(ArrowDown),
  Heart: ({ on }: { on?: boolean }) => <Heart className="ico" aria-hidden weight={on ? "fill" : "bold"} />,
};

/** An arrow between two words, as in "old > new". Screen readers hear `say`. */
export const Arrow = ({ say = "to" }: { say?: string }) => (
  <span>
    <ArrowRight className="ico size-[.85em] mx-[.3em] align-[-0.1em]" aria-hidden weight="bold" />
    <span className="sr-only">{say}</span>
  </span>
);

const SEP = " → ";

/** Text with arrows in it (as staff action labels store renames and merges), the arrows drawn as icons. */
export const arrowed = (s: string | null) => {
  if (!s || !s.includes(SEP)) return s;
  return s.split(SEP).flatMap((p, i) => i ? [<Arrow key={i} />, p] : [p]);
};

export const Spinner = ({ page }: { page?: boolean }) => (
  // a page spinner stays invisible for its first 150ms so fast pages never flash it
  <div
    className={page
      ? "spinner flex justify-center py-24 text-link animate-appear [#root>&]:animate-none [&_svg]:size-8 [&_svg]:animate-spin"
      : "spinner [&_svg]:size-5 [&_svg]:animate-spin"}
    role="status"
    aria-label="Loading"
  >
    <CircleNotch aria-hidden weight="bold" />
  </div>
);

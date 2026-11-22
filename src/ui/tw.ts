/*
 * Tailwind class lists for patterns that many files share. Write anything local to one component inline;
 * use these (combined with `cn`) when markup in several files has to look the same.
 *
 * Marker classes are kept inside the lists (`side`, `toolbar`, `row`, `cards`, `state`...): they style nothing by
 * themselves but let descendants use the region variants from tailwind.css (side:, toolbar:, ...), and let
 * selectors elsewhere (`[&_.state]`, `[.cards_&]`) find the element.
 */
import { twMerge } from "tailwind-merge";

type ClassValue = string | false | null | undefined | 0;
/** Joins class lists; when two utilities set the same thing, the later one wins. */
export const cn = (...c: ClassValue[]) => twMerge(c.filter(Boolean).join(" "));

/** Centred page column. */
export const wrap = "w-full max-w-[1180px] mx-auto px-5 max-sm:px-4";
/** Vertical padding of an ordinary page; combine with `wrap`. */
export const page = "pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold";
export const pageTitle = "page-title mb-[18px] font-display font-bold text-[36px] tracking-[-.025em] toolbar:mb-0 max-sm:text-[26px]";
export const narrow = "max-w-[560px]";
export const narrowCol = "max-w-[640px]";

/** Main column plus sidebar; the sidebar takes `side`. */
export const cols = "cols grid grid-cols-[minmax(0,1fr)_320px] gap-10 items-start max-xl:grid-cols-[minmax(0,1fr)_280px] max-xl:gap-7 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-2";
export const colsEven = "cols grid grid-cols-2 gap-10 items-start max-xl:gap-7 max-md:grid-cols-1 max-md:gap-2";
export const colsThree = "cols three grid grid-cols-3 gap-7 items-start max-lg:grid-cols-1 max-lg:gap-2";
/** The sidebar of `cols`: two columns of sections on tablets, one on phones. */
export const side = "side min-w-0 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-7 max-lg:items-start max-lg:[&>:not(section)]:col-span-full max-lg:[&>section]:mb-6 max-lg:[&>section]:min-w-0 max-sm:block";

/** Underline-free tab strip; children are links or buttons, the current one marked `active`. */
export const tabs = "tabs flex flex-wrap gap-0.5 mb-6 toolbar:mb-0 toolbar:flex-1 max-md:toolbar:max-w-full "
  + "max-md:gap-y-0 max-md:flex-nowrap max-md:overflow-x-auto max-md:overflow-y-hidden max-md:[scrollbar-width:none] max-md:gap-x-[22px] max-md:[&::-webkit-scrollbar]:hidden max-md:*:flex-none max-md:*:whitespace-nowrap "
  + "*:h-auto *:rounded-none *:m-0 *:border-0 *:bg-transparent *:px-2.5 *:py-1.5 *:text-base *:font-medium *:text-ink-2 "
  + "*:hover:bg-tint *:hover:text-ink *:hover:no-underline *:current:bg-sun *:current:text-on-sun *:current:font-bold";
/** Small filled tabs that switch a view within a section. */
export const subTabs = "tabs sub flex flex-wrap gap-1 mb-6 toolbar:mb-0 toolbar:flex-1  *:current:font-medium max-md:toolbar:max-w-full"
  + "*:m-0 *:h-auto *:rounded-none *:border-0 *:bg-fill *:px-[11px] *:py-[5px] *:text-[11px] *:font-medium *:uppercase *:tracking-[.05em] *:text-ink "
  + "*:hover:bg-fill-hover *:hover:text-ink *:current:bg-ink *:current:text-bg";

/** Title and controls on one line, stacking on phones. */
export const toolbar = "toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col";
export const row = "row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2";

/** A vertical form. Bare <label>s inside become stacked "caption over field" blocks. */
export const form = "form flex flex-col gap-3.5 items-start "
  + "[&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full "
  + "[&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full "
  + "[&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full "
  + "[&>:has(.suggest:focus-within)]:relative [&>:has(.suggest:focus-within)]:z-40 [&_.row>:has(.suggest:focus-within)]:relative [&_.row>:has(.suggest:focus-within)]:z-40";
/** A label holding a checkbox and its text side by side (beats the stacked labels of `form`). */
export const check = "check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0!";
/** Caption above a field that isn't a bare label in a `form`. */
export const fieldBlock = "flex flex-col gap-1 w-full";
export const fieldLabel = "font-semibold text-sm";
/** A one-line form: field, button, maybe a checkbox. */
export const inlineForm = "inline-form flex gap-2 items-center flex-wrap my-2.5 "
  + "max-sm:[&>.field]:flex-[1_1_180px] max-sm:[&>.field]:min-w-0 max-sm:[&>.astryx-text-input]:flex-[1_1_180px] max-sm:[&>.astryx-text-input]:min-w-0 max-sm:[&>div:has(>.astryx-text-input)]:flex-[1_1_180px] max-sm:[&>div:has(>.astryx-text-input)]:min-w-0 coarse:[&>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:px-4 [&>.check]:items-center [&>.check]:gap-2 [&>.check]:ml-2.5 [&>.check]:leading-6 max-[641px]:[&>.check]:ml-0 max-sm:[&>.check]:basis-full max-sm:[&>.check]:min-h-10";
export const formError = "form-error font-semibold m-0 text-bad";
export const formOk = "font-semibold m-0 text-ok";

export const card = "p-[18px] mb-4 bg-card";
/** Grey box for empty, loading and error states. */
export const state = "state py-7 px-[18px] text-center text-muted bg-panel [&_a]:text-link not-last:mb-[34px]";
export const stateError = "bg-bad-tint text-bad";
/** A list with hairlines between items. */
export const plain = "list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0";
export const notice = "bg-[light-dark(#f6f3ee,#121636)] border-l-[3px] border-accent py-2.5 px-3.5 mt-0 mb-5";

export const kicker = "kicker uppercase text-[11px] font-medium tracking-[.08em] text-link";
/** A row of `Stat`s. */
export const stats = "stats flex flex-wrap gap-7 max-sm:gap-x-[22px] max-sm:gap-y-4 max-sm:hero:gap-x-5 max-sm:hero:gap-y-2.5";
/** `stats` in one shaded box, stats splitting it evenly. */
export const statsBoxed = "stats boxed flex flex-wrap gap-0 mb-7 bg-panel *:flex-1 *:min-w-[140px] *:px-[18px] *:py-3.5 max-sm:*:min-w-1/2 max-sm:*:border-b max-sm:*:border-line";

export const badge = "inline-block text-[11px] uppercase tracking-[.05em] px-1.5 py-px font-medium bg-ink text-bg";
export const badgeWarn = "bg-accent-tint text-ink";
export const badgeOff = "bg-fill text-muted";

/** Two-column definition list: dt in muted text, dd beside it. */
export const keys = "keys grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-2 mb-0 text-sm [&_dd]:m-0 [&_dd]:wrap-anywhere [&_dt]:text-muted";
/** "View all" style link. */
export const more = "more whitespace-nowrap text-link text-sm font-semibold hover:underline [&_.ico]:align-[-0.15em]";

export const chips = "inline-flex flex-wrap gap-1.5";
export const chip = "inline-block rounded-none border-0 bg-fill px-2.5 py-[3px] text-[13px] font-medium text-ink hover:bg-fill-hover hover:text-ink hover:no-underline "
  + "coarse:min-h-8 coarse:inline-flex coarse:items-center [&_b]:ml-1 [&_b]:font-semibold [&_b]:text-muted hover:[&_b]:text-white "
  + "hero:bg-bg hero:hover:bg-card hero:[&_b]:text-muted";

/** Text with inline links in it (the base styles only colour links inside <p>). */
export const prose = "prose max-w-[68ch] leading-[1.6] whitespace-pre-line [&_a]:text-link [&_a:hover]:underline";

/*
 * Ranked tables (charts, libraries, scrobbles). Cells keep a `c-*` marker where other rules need to find them.
 * Zebra rows; a `now` row (playing) is tinted.
 */
export const chartlist = "w-full border-collapse [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-middle max-sm:[&_td]:px-1 "
  + "[&_tr:nth-child(even)_td]:bg-zebra [&_tr:hover_td]:bg-panel [&_tr.now_td]:bg-accent-tint";
/** A short chartlist in a column: its count column hugs the numbers. */
export const chartlistSlim = "mb-3.5 [&_.c-count]:w-[1%]";
/** A chartlist whose name column doesn't take all the spare width. */
export const chartlistCompact = "[&_.c-name]:w-auto";
export const cRank = "w-[34px] text-right text-sm font-semibold text-muted tabular-nums max-sm:w-[22px]";
export const cPlay = "w-[38px] px-0.5! text-center three:hidden";
export const cLove = "w-[30px] px-0.5! text-center three:hidden coarse:[&_.astryx-button]:relative coarse:[&_.astryx-button]:after:absolute coarse:[&_.astryx-button]:after:-inset-1.5 coarse:[&_.astryx-button]:after:content-['']";
export const cArt = "w-[52px] max-sm:w-[44px] [&_.art]:w-[38px]";
/** Name cell: links and spans inside are cut with an ellipsis. */
export const cName = "c-name w-full max-w-0 [&_a]:block [&_a]:truncate [&_span]:block [&_span]:truncate";
export const cDur = "text-right text-sm whitespace-nowrap text-muted tabular-nums";
export const cTime = "c-time w-[150px] text-right text-sm whitespace-nowrap text-muted tabular-nums max-lg:w-auto "
  + "max-sm:w-[76px] max-sm:min-w-[76px] max-sm:whitespace-normal max-sm:leading-[1.25]";
export const cCount = "c-count text-right text-sm whitespace-nowrap text-muted tabular-nums";
export const cActions = "c-actions text-right whitespace-nowrap max-sm:w-[1%] max-sm:px-1";
/** Buttons in a row that show on hover (always on touch screens and phones). */
export const rowActions = "inline-flex gap-2.5 invisible [tr:hover_&]:visible [tr:focus-within_&]:visible max-sm:visible touch:visible coarse:[&_.astryx-button]:min-h-9 "
  + "max-sm:[.c-actions_&]:flex-col max-sm:[.c-actions_&]:items-end max-sm:[.c-actions_&]:gap-0 max-sm:[.c-actions_&_.astryx-button]:text-[13px] max-sm:[.c-actions_&_.astryx-button]:min-h-7";
/** Cell holding a `bar`; the bar shrinks with the screen and becomes plain text on phones. */
export const cBar = "w-[1%] max-sm:text-right "
  + "[&_.bar]:w-[260px] max-lg:[&_.bar]:w-[200px] max-md:[&_.bar]:w-[130px] side:[&_.bar]:w-[130px] three:[&_.bar]:w-[130px] "
  + "max-sm:[&_.bar]:w-auto max-sm:side:[&_.bar]:w-auto max-sm:three:[&_.bar]:w-auto max-sm:[&_.bar]:p-0 max-sm:[&_.bar]:text-ink-2 max-sm:[&_.bar]:text-[13px] "
  + "max-sm:[&_.bar>span]:hidden max-sm:[&_.bar_b]:font-medium max-md:[&_em]:hidden [tr:not(:first-child)_&_em]:hidden";
/** Horizontal bar: <a|span class=bar><span class=barFill style=width/> <b>count</b> <em>note</em></a|span> */
export const bar = "bar relative block h-7 leading-7 pl-2 text-sm whitespace-nowrap text-ink";
export const barFill = "absolute left-0 top-0 bottom-0 bg-accent-tint [a:hover>&]:bg-bar-fill-hover";
export const barNum = "relative not-italic";
export const barNote = "relative not-italic text-ink-2";

/** Now playing: "▶ now" text and the little equaliser beside it. */
export const np = "text-accent-dark font-semibold whitespace-nowrap max-sm:[.c-time_&]:whitespace-normal";
export const eq = "inline-flex gap-0.5 items-end h-[11px] ml-[3px] [&_i]:w-[3px] [&_i]:bg-accent [&_i]:animate-eq [&_i:nth-child(2)]:[animation-delay:-.3s] [&_i:nth-child(3)]:[animation-delay:-.6s] reduced:[&_i]:animate-none reduced:[&_i]:h-2";

/** Bulleted-free lists of people, notifications, similar artists...: rows with hairlines. */
export const list = "list-none m-0 p-0";
export const listItem = "flex gap-3 items-center py-2.5 border-b border-line";
/** The text column of a listItem: each line is cut with an ellipsis. */
export const listText = "flex-1 min-w-0 *:block *:overflow-hidden *:text-ellipsis";
export const listItemUnread = "bg-accent-faint border-l-[3px] border-l-accent pl-2.5";
/** A track pinned as someone's earworm: cover, then lines of text. */
export const obsession = "flex gap-3 items-start [&>a]:w-[84px] [&>a]:flex-none [&>div>*]:block [&>div>*]:overflow-hidden [&>div>*]:text-ellipsis [&_p]:my-1";

/** Grid of cards; set data-cols and the --cols variable. Trailing half rows are hidden by styles.css when its section has a "more" link. */
export const grid = "cards grid grid-cols-[repeat(var(--cols,6),minmax(0,1fr))] gap-x-3.5 gap-y-[18px] max-sm:gap-x-2.5 max-sm:gap-y-3.5 "
  + "max-md:data-[cols=5]:grid-cols-4 max-md:data-[cols=6]:grid-cols-4 "
  + "max-sm:[&[data-cols]:not([data-cols='4'],[data-cols='5'],[data-cols='6'])]:grid-cols-2 max-sm:data-[cols=4]:grid-cols-3 max-sm:data-[cols=5]:grid-cols-3 max-sm:data-[cols=6]:grid-cols-3";
/** `grid` of plain cards (cover above caption) rather than captioned images. */
export const gridBelow = "below gap-x-[18px] gap-y-[22px] max-sm:gap-x-[18px] max-sm:gap-y-[22px] side:gap-3 max-sm:side:gap-3 "
  + "max-md:data-[cols=4]:grid-cols-2 max-sm:data-[cols=4]:grid-cols-2 max-md:data-[cols=6]:grid-cols-3";
/** Cover with a title and a muted line under it. */
export const mcard = "mcard flex flex-col min-w-0 text-left text-ink hover:text-ink [&_.art]:mb-2 "
  + "[&_strong]:text-base [&_strong]:leading-[1.25] [&_strong]:truncate hover:[&_strong]:underline side:[&_strong]:text-sm "
  + "[&_span]:text-[13px] [&_span]:text-muted [&_span]:truncate";

/** Round counter badge. */
export const dot = "dot inline-block text-xs min-w-5 h-5 leading-5 text-center rounded-[10px] px-[5px] bg-accent text-on-accent";
/** Round user picture box; size it with width/height. `avatar` lets lists resize it. */
export const avatar = "avatar block flex-none overflow-hidden rounded-full bg-panel";
/** Selection toolbar above a list. */
export const bulkBar = "flex items-center gap-3 flex-wrap min-h-9 mt-0 mb-2 [&_p]:m-0";
/** Documentation text: like prose but wraps normally. */
export const docs = "whitespace-normal [&_h2]:mt-[26px] [&_h2]:mb-2.5 [&_pre]:whitespace-pre";

/** Browser-native input (dates, numbers, files) dressed like the Astryx fields. */
export const nativeInput = "[font:inherit] text-inherit max-w-full rounded-none border border-edge bg-card px-2.5 py-2 shadow-[inset_0_1px_3px_var(--inset)] "
  + "placeholder:text-muted placeholder:opacity-100 focus:outline-0 focus:border-accent focus:shadow-[inset_0_1px_3px_var(--inset),0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]";
/** Borderless heart toggle (pass to Button's className); add `loveOn` when loved. */
export const love = "bg-transparent border-0 p-1 text-[20px] leading-none text-muted hover:text-link";
export const loveOn = "text-link";
/** Borderless icon-only button. */
export const iconBtn = "bg-transparent border-0 px-2 py-1.5 text-[15px] hover:text-link [&_.ico]:size-[18px]";
/** A button that reads as a text link (pass to Button's className); add `linkBtnOn` for the current one. */
export const linkBtn = "bg-transparent border-0 p-0 text-link font-semibold hover:underline";
export const linkBtnOn = "text-ink font-bold";

/** Hidden from sight, kept for screen readers. */
export const sr = "sr-only";

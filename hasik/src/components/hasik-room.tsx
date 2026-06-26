"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  CreditCard,
  Dices,
  Flag,
  Gift,
  Megaphone,
  Pointer,
  Scissors,
  Send,
  Settings2,
  Users,
  UserRound
} from "lucide-react";
import { getHasikRoomName, getSupabaseBrowserClient } from "@/lib/supabase";

type Role = "인턴" | "사원" | "대리" | "과장" | "부장";
type Mood = "quiet" | "talk" | "afterwork";
type RealtimeMode = "demo" | "setup" | "live";
type PaymentMethod = "split" | "single" | "roulette" | "rps";
export type TableShape = "round" | "rectangle";
export type RoomVenue = "a" | "b" | "c";

interface HasikRoomProps {
  initialRoomTitle?: string;
  initialTableShape?: TableShape;
  initialRoomVenue?: RoomVenue;
  initialQuickJoinEnabled?: boolean;
  canManageRoomSettings?: boolean;
  debugMode?: boolean;
  roomNameOverride?: string;
  onLeave?: () => void;
  onRoomTitleChange?: (title: string) => void;
  onTableShapeChange?: (shape: TableShape) => void;
  onRoomVenueChange?: (venue: RoomVenue) => void;
  onQuickJoinChange?: (enabled: boolean) => void;
}

interface ChatMessage {
  id: string;
  nickname: string;
  role: Role;
  body: string;
  at: number;
  kind?: "normal" | "system" | "bell";
}

interface PresenceUser {
  id: string;
  nickname: string;
  role: Role;
  joinedAt: number;
  mood: Mood;
}

interface HasikMessageRow {
  id: string;
  room: string;
  nickname: string;
  role: Role;
  body: string;
  kind: ChatMessage["kind"];
  created_at: string;
}

interface MenuSelection {
  id: string;
  userId: string;
  nickname: string;
  role: Role;
  itemId: string;
  x: number;
  y: number;
  at: number;
}

interface SecretCheckout {
  userId: string;
  nickname: string;
  role: Role;
  at: number;
}

interface CompletedOrder {
  id: string;
  payerNickname: string;
  payerRole: Role;
  amount: number;
  at: number;
  label?: string;
}

interface PaymentVote {
  userId: string;
  nickname: string;
  role: Role;
  method: PaymentMethod;
  at: number;
}

interface PaymentParticipant {
  userId: string;
  nickname: string;
  role: Role;
  at: number;
}

const chatCooldownMs = 500;
const defaultWalletBalance = 120000;
const walletStorageKey = "hasik:wallet-balance";
const roles: Role[] = ["인턴", "사원", "대리", "과장", "부장"];
const menuItems = [
  { id: "kimchi-jeon", name: "김치전", price: 16000, kind: "food", icon: "전" },
  { id: "fishcake-soup", name: "어묵탕", price: 18000, kind: "food", icon: "탕" },
  { id: "chicken-skewer", name: "닭꼬치", price: 14000, kind: "food", icon: "꼬치" },
  { id: "dried-pollack", name: "먹태", price: 19000, kind: "food", icon: "먹태" },
  { id: "highball", name: "하이볼", price: 9000, kind: "drink", icon: "잔" },
  { id: "zero-cola", name: "제로콜라", price: 3000, kind: "drink", icon: "콜라" },
  { id: "corn-tea", name: "옥수수차", price: 4000, kind: "drink", icon: "차" }
] as const;

const paymentOptions: Array<{
  id: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Users;
}> = [
  { id: "split", label: "더치페이", description: "각자 주문한 만큼 나누기", icon: Users },
  { id: "single", label: "한 명이 계산", description: "오늘의 결제 담당 한 명 지정", icon: CreditCard },
  { id: "roulette", label: "룰렛", description: "운에 맡겨 결제 담당 뽑기", icon: Dices },
  { id: "rps", label: "가위바위보", description: "짧게 승부 보고 정하기", icon: Scissors }
];

const bubbleLifetimeMs = 10000;
const clockMarks = Array.from({ length: 12 }, (_, index) => index * 30);
const maxSeatCount = 8;
const initialRenderTime = Date.UTC(2026, 0, 1, 12, 0);
const koreanSurnames = Array.from(new Set([
  "김",
  "이",
  "박",
  "최",
  "정",
  "강",
  "조",
  "윤",
  "장",
  "임",
  "한",
  "오",
  "서",
  "신",
  "권",
  "황",
  "안",
  "송",
  "류",
  "전",
  "홍",
  "고",
  "문",
  "양",
  "손",
  "배",
  "백",
  "허",
  "유",
  "남",
  "심",
  "노",
  "하",
  "곽",
  "성",
  "차",
  "주",
  "우",
  "구",
  "민",
  "진",
  "지",
  "엄",
  "채",
  "원",
  "천",
  "방",
  "공",
  "현",
  "함",
  "변",
  "염",
  "여",
  "추",
  "도",
  "소",
  "석",
  "선",
  "설",
  "마",
  "길",
  "연",
  "위",
  "표",
  "명",
  "기",
  "반",
  "견",
  "곡",
  "궉",
  "군",
  "나",
  "뇌",
  "단",
  "당",
  "등",
  "만",
  "목",
  "미",
  "수",
  "음",
  "점",
  "준",
  "태",
  "필",
  "형",
  "왕",
  "금",
  "옥",
  "육",
  "인",
  "맹",
  "제",
  "탁",
  "국",
  "모",
  "어",
  "은",
  "편",
  "용",
  "예",
  "봉",
  "사",
  "부",
  "빈",
  "피",
  "가",
  "간",
  "갈",
  "감",
  "경",
  "계",
  "궁",
  "내",
  "담",
  "대",
  "돈",
  "동",
  "두",
  "라",
  "매",
  "묵",
  "묘",
  "범",
  "복",
  "빙",
  "상",
  "승",
  "시",
  "아",
  "애",
  "야",
  "온",
  "옹",
  "완",
  "운",
  "자",
  "종",
  "좌",
  "창",
  "초",
  "탄",
  "판",
  "팽",
  "해",
  "호",
  "화"
]));
const debugRoster: Array<Pick<PresenceUser, "id" | "nickname" | "role" | "mood">> = [
  { id: "debug-seat-1", nickname: "김인턴", role: "인턴", mood: "talk" },
  { id: "debug-seat-2", nickname: "오사원", role: "사원", mood: "afterwork" },
  { id: "debug-seat-3", nickname: "박대리", role: "대리", mood: "talk" },
  { id: "debug-seat-4", nickname: "최과장", role: "과장", mood: "quiet" },
  { id: "debug-seat-5", nickname: "정부장", role: "부장", mood: "afterwork" },
  { id: "debug-seat-6", nickname: "강사원", role: "사원", mood: "talk" },
  { id: "debug-seat-7", nickname: "이대리", role: "대리", mood: "afterwork" }
];
const debugChatBodies = [
  "지금 말풍선 기본 길이 확인 중입니다.",
  "평범한 길이의 회식방 채팅입니다. 이 정도면 보통 대화처럼 보여야 합니다.",
  "조금 더 긴 문장을 보내서 옆자리 말풍선과 간격이 자연스럽게 유지되는지 확인하고 있습니다.",
  "최대 글자수에 가까운 테스트 문장입니다. 말풍선이 가능한 한 길게 늘어나되 다른 사람 말풍선과 겹치지 않고 원탁에서는 두 줄만 보여야 합니다."
];
const seatPositions = [
  { x: 50, y: 88 },
  { x: 24, y: 76 },
  { x: 12, y: 50 },
  { x: 24, y: 24 },
  { x: 50, y: 14 },
  { x: 76, y: 24 },
  { x: 88, y: 50 },
  { x: 76, y: 76 }
] as const;

function createSeedMessages(baseTime: number): ChatMessage[] {
  return [
    {
      id: "seed-1",
      nickname: "최대리",
      role: "대리",
      body: "다들 오늘 회의 몇 시에 끝났나요",
      at: baseTime - 1000 * 60 * 5
    },
    {
      id: "seed-2",
      nickname: "박인턴",
      role: "인턴",
      body: "저는 방금 퇴근했습니다. 메뉴판부터 봅니다",
      at: baseTime - 1000 * 60 * 3
    },
    {
      id: "seed-3",
      nickname: "윤과장",
      role: "과장",
      body: "오늘은 제로콜라 골든벨입니다",
      at: baseTime - 1000 * 60,
      kind: "bell"
    }
  ];
}

const seedMessages = createSeedMessages(initialRenderTime);
const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const roomVenues: Array<{
  id: RoomVenue;
  label: string;
  image: string;
}> = [
  { id: "a", label: "장소 A", image: "/assets/hasik/venue-a-pocha.png" },
  { id: "b", label: "장소 B", image: "/assets/hasik/venue-b-hanok.png" },
  { id: "c", label: "장소 C", image: "/assets/hasik/venue-c-lounge.png" }
];

function getAssetPath(path: string) {
  return `${assetBasePath}${path}`;
}

function getSavedWalletBalance() {
  if (typeof window === "undefined") {
    return defaultWalletBalance;
  }

  try {
    const savedBalance = Number(localStorage.getItem(walletStorageKey));

    if (Number.isFinite(savedBalance) && savedBalance >= 0) {
      return Math.floor(savedBalance);
    }
  } catch {
    return defaultWalletBalance;
  }

  return defaultWalletBalance;
}

function isRoomVenue(value: unknown): value is RoomVenue {
  return value === "a" || value === "b" || value === "c";
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createAnonymousNickname(role: Role) {
  const surname = koreanSurnames[Math.floor(Math.random() * koreanSurnames.length)];
  return `${surname}${role}`;
}

function formatClock(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatPeriod(value: number) {
  return new Date(value).getHours() < 12 ? "오전" : "오후";
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getLevel(minutes: number) {
  if (minutes >= 40) {
    return { title: "팀장석", progress: 100, next: "오늘의 골든벨" };
  }

  if (minutes >= 20) {
    return { title: "과장석", progress: 72, next: "팀장석까지 20분" };
  }

  if (minutes >= 8) {
    return { title: "대리석", progress: 42, next: "과장석까지 12분" };
  }

  return { title: "인턴석", progress: 18, next: "대리석까지 8분" };
}

function getMemberKey(nickname: string, role: Role) {
  return `${nickname}:${role}`;
}

function stripRoleSuffix(nickname: string, role: Role) {
  const baseName = nickname.replace(/익명\d+$/, "");
  return baseName.endsWith(role) ? baseName.slice(0, -role.length) || baseName : baseName;
}

function getRoleTone(role: Role) {
  switch (role) {
    case "인턴":
      return "intern";
    case "사원":
      return "staff";
    case "대리":
      return "assistant-manager";
    case "과장":
      return "manager";
    case "부장":
      return "director";
  }
}

function NameWithRole({ nickname, role }: { nickname: string; role: Role }) {
  return (
    <span className="display-name">
      <span>{stripRoleSuffix(nickname, role)}</span>
      <span className={`role-label ${getRoleTone(role)}`}>{role}</span>
    </span>
  );
}

function mapMessageRow(row: HasikMessageRow): ChatMessage {
  return {
    id: row.id,
    nickname: row.nickname,
    role: row.role,
    body: row.body,
    kind: row.kind,
    at: new Date(row.created_at).getTime()
  };
}

function mergeMessage(current: ChatMessage[], nextMessage: ChatMessage) {
  if (current.some((message) => message.id === nextMessage.id)) {
    return current;
  }

  return [...current, nextMessage]
    .sort((left, right) => left.at - right.at)
    .slice(-80);
}

function createDebugMessage(member: PresenceUser, at: number, index: number): ChatMessage {
  const body = debugChatBodies[index % debugChatBodies.length];

  return {
    id: `debug-message-${member.id}-${at}-${index}`,
    nickname: member.nickname,
    role: member.role,
    body: body.slice(0, 120),
    at,
    kind: "normal"
  };
}

export function HasikRoom({
  initialRoomTitle = "퇴근 후 익명 회식방",
  initialTableShape = "round",
  initialRoomVenue = "a",
  initialQuickJoinEnabled = true,
  canManageRoomSettings = false,
  debugMode = false,
  roomNameOverride,
  onLeave,
  onRoomTitleChange,
  onTableShapeChange,
  onRoomVenueChange,
  onQuickJoinChange
}: HasikRoomProps = {}) {
  const selectedRole: Role = "대리";
  const mood: Mood = "afterwork";
  const [nickname] = useState(() => createAnonymousNickname(selectedRole));
  const [roomTitle, setRoomTitle] = useState(initialRoomTitle);
  const [tableShape, setTableShape] = useState<TableShape>(initialTableShape);
  const [roomVenue, setRoomVenue] = useState<RoomVenue>(initialRoomVenue);
  const [quickJoinEnabled, setQuickJoinEnabled] = useState(initialQuickJoinEnabled);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>("demo");
  const [activeProfile, setActiveProfile] = useState<ChatMessage | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isOrderChoiceOpen, setOrderChoiceOpen] = useState(false);
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(getSavedWalletBalance);
  const [menuSelections, setMenuSelections] = useState<Record<string, MenuSelection>>({});
  const [paymentVotes, setPaymentVotes] = useState<Record<string, PaymentVote>>({});
  const [paymentParticipants, setPaymentParticipants] = useState<Record<string, PaymentParticipant>>({});
  const [paymentVoteEndsAt, setPaymentVoteEndsAt] = useState<number | null>(null);
  const [paymentVoteClosedAt, setPaymentVoteClosedAt] = useState<number | null>(null);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod | null>(null);
  const [secretCheckout, setSecretCheckout] = useState<SecretCheckout | null>(null);
  const [secretAmount, setSecretAmount] = useState("");
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [reportStatus, setReportStatus] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  const [hasMounted, setHasMounted] = useState(false);
  const [startedAt, setStartedAt] = useState(initialRenderTime);
  const [now, setNow] = useState(initialRenderTime);
  const sessionIdRef = useRef(createId());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const chatFeedRef = useRef<HTMLDivElement | null>(null);
  const menuListRef = useRef<HTMLDivElement | null>(null);
  const activeComposerInputRef = useRef<HTMLInputElement | null>(null);

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const roomName = useMemo(() => roomNameOverride ?? getHasikRoomName(), [roomNameOverride]);
  const stayMinutes = Math.floor((now - startedAt) / 60000);
  const level = getLevel(stayMinutes);
  const cooldownRemainingMs = Math.max(0, cooldownUntil - Date.now());
  const isCoolingDown = cooldownRemainingMs > 0;
  const onlineCount = debugMode
    ? maxSeatCount
    : supabase
    ? Math.max(presence.length, 1)
    : hasMounted
      ? 17 + (Math.floor(now / 1000) % 5)
      : 17;
  const currentDate = new Date(now);
  const hourAngle = ((currentDate.getHours() % 12) + currentDate.getMinutes() / 60) * 30;
  const minuteAngle = (currentDate.getMinutes() + currentDate.getSeconds() / 60) * 6;
  const clockStyle = {
    "--hour-angle": `${hourAngle}deg`,
    "--minute-angle": `${minuteAngle}deg`
  } as CSSProperties;

  const menuSelectionList = useMemo(() => Object.values(menuSelections), [menuSelections]);
  const orderedMenuItems = useMemo(() => {
    return menuItems
      .map((item) => ({
        ...item,
        count: menuSelectionList.filter((selection) => selection.itemId === item.id).length
      }))
      .filter((item) => item.count > 0);
  }, [menuSelectionList]);
  const orderTotal = orderedMenuItems.reduce((total, item) => total + item.price * item.count, 0);
  const paymentVoteList = useMemo(() => Object.values(paymentVotes), [paymentVotes]);
  const paymentVoteCounts = useMemo(() => {
    return paymentOptions.map((option) => ({
      ...option,
      count: paymentVoteList.filter((vote) => vote.method === option.id).length
    }));
  }, [paymentVoteList]);
  const paymentParticipantList = useMemo(
    () => Object.values(paymentParticipants),
    [paymentParticipants]
  );
  const paymentParticipantCount = paymentParticipantList.length;
  const paymentRequiredVoteCount =
    paymentParticipantCount > 0 ? Math.floor(paymentParticipantCount / 2) + 1 : 1;
  const selectedPaymentVoteCount = paymentVoteList.filter(
    (vote) => paymentParticipants[vote.userId]
  ).length;
  const winningPaymentMethod = paymentVoteCounts.reduce(
    (winner, option) => (option.count > winner.count ? option : winner),
    paymentVoteCounts[0]
  );
  const finalPaymentOption =
    paymentOptions.find((option) => option.id === finalPaymentMethod) ?? null;
  const paymentVoteRemainingSeconds = paymentVoteEndsAt
    ? Math.max(0, Math.ceil((paymentVoteEndsAt - now) / 1000))
    : null;
  const isSecretCheckoutMine = secretCheckout?.userId === sessionIdRef.current;
  const secretCheckoutAmount = Number(secretAmount.replace(/[^\d]/g, ""));
  const selectedVenue = roomVenues.find((venue) => venue.id === roomVenue) ?? roomVenues[0];
  const venueBackdropStyle = {
    "--room-venue-image": `url("${getAssetPath(selectedVenue.image)}")`
  } as CSSProperties;
  const menuButtonImage = getAssetPath("/assets/hasik/menu-clipboard.png");

  const user = useMemo<PresenceUser>(
    () => ({
      id: sessionIdRef.current,
      nickname,
      role: selectedRole,
      joinedAt: startedAt,
      mood
    }),
    [nickname, startedAt]
  );

  const debugMembers = useMemo<PresenceUser[]>(() => {
    return [
      user,
      ...debugRoster.map((member, index) => ({
        ...member,
        joinedAt: startedAt - (index + 1) * 42000
      }))
    ].slice(0, maxSeatCount);
  }, [startedAt, user]);

  const seatMembers = useMemo(() => {
    if (debugMode) {
      return Array.from({ length: maxSeatCount }, (_, index) => debugMembers[index] ?? null);
    }

    const nextMembers: PresenceUser[] = [user];
    const seenMemberIds = new Set([user.id]);

    presence.forEach((member) => {
      if (seenMemberIds.has(member.id) || nextMembers.length >= maxSeatCount) {
        return;
      }

      nextMembers.push(member);
      seenMemberIds.add(member.id);
    });

    return Array.from({ length: maxSeatCount }, (_, index) => nextMembers[index] ?? null);
  }, [debugMembers, debugMode, presence, user]);

  const latestMessageByMember = useMemo(() => {
    const nextMessages = new Map<string, ChatMessage>();

    messages.forEach((message) => {
      nextMessages.set(getMemberKey(message.nickname, message.role), message);
    });

    return nextMessages;
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => now - message.at <= bubbleLifetimeMs),
    [messages, now]
  );

  const keepComposerFocus = useCallback(() => {
    const inputElement = activeComposerInputRef.current;

    if (!inputElement) {
      return;
    }

    inputElement.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const mountedAt = Date.now();
    setHasMounted(true);
    setStartedAt(mountedAt);
    setNow(mountedAt);

    if (!supabase) {
      setMessages(createSeedMessages(mountedAt));
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [supabase]);

  useEffect(() => {
    try {
      localStorage.setItem(walletStorageKey, String(walletBalance));
    } catch {
      return;
    }
  }, [walletBalance]);

  useEffect(() => {
    setQuickJoinEnabled(initialQuickJoinEnabled);
  }, [initialQuickJoinEnabled]);

  useEffect(() => {
    setRoomVenue(initialRoomVenue);
  }, [initialRoomVenue]);

  useEffect(() => {
    if (!canManageRoomSettings && isSettingsOpen) {
      setSettingsOpen(false);
    }
  }, [canManageRoomSettings, isSettingsOpen]);

  useEffect(() => {
    if (!isCoolingDown) {
      return;
    }

    const timer = window.setInterval(() => setCooldownTick((value) => value + 1), 100);
    return () => window.clearInterval(timer);
  }, [isCoolingDown]);

  useEffect(() => {
    const feed = chatFeedRef.current;

    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  }, [visibleMessages]);

  useEffect(() => {
    setReportStatus("");
  }, [activeProfile]);

  useEffect(() => {
    if (!isPaymentOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [isPaymentOpen]);

  useEffect(() => {
    if (!isPaymentOpen || completedOrder) {
      return;
    }

    const participant: PaymentParticipant = {
      userId: sessionIdRef.current,
      nickname,
      role: selectedRole,
      at: Date.now()
    };

    setPaymentParticipants((current) => ({
      ...current,
      [participant.userId]: participant
    }));
    void channelRef.current?.send({
      type: "broadcast",
      event: "payment_participant_join",
      payload: participant
    });

    return () => {
      setPaymentParticipants((current) => {
        const { [participant.userId]: _removed, ...nextParticipants } = current;
        return nextParticipants;
      });
      void channelRef.current?.send({
        type: "broadcast",
        event: "payment_participant_leave",
        payload: { userId: participant.userId }
      });
    };
  }, [completedOrder, isPaymentOpen, nickname, selectedRole]);

  useEffect(() => {
    if (!supabase) {
      setConnected(false);
      setRealtimeMode("demo");
      setPresence([
        user,
        { id: "demo-1", nickname: "정사원", role: "사원", joinedAt: Date.now() - 200000, mood: "talk" },
        { id: "demo-2", nickname: "오부장", role: "부장", joinedAt: Date.now() - 500000, mood: "quiet" }
      ]);
      return;
    }

    if (debugMode) {
      setConnected(false);
      setRealtimeMode("demo");
      setPresence([]);
      return;
    }

    const client = supabase;
    let isActive = true;
    const channel = client.channel(`hasik:${roomName}`, {
      config: {
        broadcast: { self: true },
        presence: { key: sessionIdRef.current }
      }
    });

    async function loadRecentMessages() {
      const { data, error } = await client
        .from("hasik_messages")
        .select("id, room, nickname, role, body, kind, created_at")
        .eq("room", roomName)
        .order("created_at", { ascending: false })
        .limit(80);

      if (!isActive) {
        return;
      }

      if (error) {
        setRealtimeMode("setup");
        return;
      }

      const nextMessages = ((data ?? []) as HasikMessageRow[]).reverse().map(mapMessageRow);
      setMessages(nextMessages.length > 0 ? nextMessages : seedMessages);
      setRealtimeMode("live");
    }

    void loadRecentMessages();

    channel
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "hasik_messages",
        filter: `room=eq.${roomName}`
      }, ({ new: payload }) => {
        const nextMessage = mapMessageRow(payload as HasikMessageRow);
        setMessages((current) => mergeMessage(current, nextMessage));
      })
      .on("broadcast", { event: "room_settings" }, ({ payload }) => {
        if (typeof payload?.roomTitle === "string") {
          const nextTitle = payload.roomTitle.slice(0, 28);
          setRoomTitle(nextTitle);
          onRoomTitleChange?.(nextTitle);
        }

        if (payload?.tableShape === "round" || payload?.tableShape === "rectangle") {
          const nextShape = payload.tableShape;
          setTableShape(nextShape);
          onTableShapeChange?.(nextShape);
        }

        if (isRoomVenue(payload?.roomVenue)) {
          setRoomVenue(payload.roomVenue);
          onRoomVenueChange?.(payload.roomVenue);
        }

        if (typeof payload?.quickJoinEnabled === "boolean") {
          setQuickJoinEnabled(payload.quickJoinEnabled);
          onQuickJoinChange?.(payload.quickJoinEnabled);
        }
      })
      .on("broadcast", { event: "menu_selection" }, ({ payload }) => {
        if (
          typeof payload?.userId !== "string" ||
          typeof payload?.id !== "string" ||
          typeof payload?.nickname !== "string" ||
          typeof payload?.role !== "string" ||
          typeof payload?.itemId !== "string" ||
          typeof payload?.x !== "number" ||
          typeof payload?.y !== "number" ||
          typeof payload?.at !== "number" ||
          !roles.includes(payload.role as Role) ||
          !menuItems.some((item) => item.id === payload.itemId)
        ) {
          return;
        }

        const nextSelection: MenuSelection = {
          id: payload.id,
          userId: payload.userId,
          nickname: payload.nickname,
          role: payload.role as Role,
          itemId: payload.itemId,
          x: clampPercent(payload.x),
          y: clampPercent(payload.y),
          at: payload.at
        };

        setMenuSelections((current) => ({
          ...current,
          [nextSelection.id]: nextSelection
        }));
      })
      .on("broadcast", { event: "menu_selection_remove" }, ({ payload }) => {
        if (typeof payload?.id !== "string") {
          return;
        }

        setMenuSelections((current) => {
          const { [payload.id]: _removed, ...nextSelections } = current;
          return nextSelections;
        });
      })
      .on("broadcast", { event: "payment_vote" }, ({ payload }) => {
        if (
          typeof payload?.userId !== "string" ||
          typeof payload?.nickname !== "string" ||
          typeof payload?.role !== "string" ||
          typeof payload?.method !== "string" ||
          typeof payload?.at !== "number" ||
          !roles.includes(payload.role as Role) ||
          !paymentOptions.some((option) => option.id === payload.method)
        ) {
          return;
        }

        const nextVote: PaymentVote = {
          userId: payload.userId,
          nickname: payload.nickname,
          role: payload.role as Role,
          method: payload.method as PaymentMethod,
          at: payload.at
        };

        setPaymentVotes((current) => ({
          ...current,
          [nextVote.userId]: nextVote
        }));
      })
      .on("broadcast", { event: "payment_participant_join" }, ({ payload }) => {
        if (
          typeof payload?.userId !== "string" ||
          typeof payload?.nickname !== "string" ||
          typeof payload?.role !== "string" ||
          typeof payload?.at !== "number" ||
          !roles.includes(payload.role as Role)
        ) {
          return;
        }

        const nextParticipant: PaymentParticipant = {
          userId: payload.userId,
          nickname: payload.nickname,
          role: payload.role as Role,
          at: payload.at
        };

        setPaymentParticipants((current) => ({
          ...current,
          [nextParticipant.userId]: nextParticipant
        }));
      })
      .on("broadcast", { event: "payment_participant_leave" }, ({ payload }) => {
        if (typeof payload?.userId !== "string") {
          return;
        }

        setPaymentParticipants((current) => {
          const { [payload.userId]: _removed, ...nextParticipants } = current;
          return nextParticipants;
        });
      })
      .on("broadcast", { event: "payment_vote_countdown" }, ({ payload }) => {
        if (typeof payload?.endsAt !== "number" || !Number.isFinite(payload.endsAt)) {
          return;
        }

        setPaymentVoteEndsAt(payload.endsAt);
      })
      .on("broadcast", { event: "payment_vote_closed" }, ({ payload }) => {
        if (
          typeof payload?.method !== "string" ||
          !paymentOptions.some((option) => option.id === payload.method)
        ) {
          return;
        }

        setFinalPaymentMethod(payload.method as PaymentMethod);
        setPaymentVoteClosedAt(
          typeof payload?.at === "number" && Number.isFinite(payload.at) ? payload.at : Date.now()
        );
        setPaymentVoteEndsAt(null);
      })
      .on("broadcast", { event: "secret_checkout" }, ({ payload }) => {
        if (
          typeof payload?.userId !== "string" ||
          typeof payload?.nickname !== "string" ||
          typeof payload?.role !== "string" ||
          typeof payload?.at !== "number" ||
          !roles.includes(payload.role as Role)
        ) {
          return;
        }

        setSecretCheckout({
          userId: payload.userId,
          nickname: payload.nickname,
          role: payload.role as Role,
          at: payload.at
        });
      })
      .on("broadcast", { event: "order_completed" }, ({ payload }) => {
        if (
          typeof payload?.id !== "string" ||
          typeof payload?.payerNickname !== "string" ||
          typeof payload?.payerRole !== "string" ||
          typeof payload?.amount !== "number" ||
          typeof payload?.at !== "number" ||
          !roles.includes(payload.payerRole as Role)
        ) {
          return;
        }

        setCompletedOrder({
          id: payload.id,
          payerNickname: payload.payerNickname,
          payerRole: payload.payerRole as Role,
          amount: payload.amount,
          at: payload.at,
          label: typeof payload?.label === "string" ? payload.label : undefined
        });
        setSecretCheckout(null);
        setPaymentVotes({});
        setPaymentParticipants({});
        setPaymentVoteEndsAt(null);
        setPaymentVoteClosedAt(null);
        setFinalPaymentMethod(null);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const nextPresence = Object.values(state).flat();
        setPresence(nextPresence);
      })
      .subscribe(async (status) => {
        const isSubscribed = status === "SUBSCRIBED";
        setConnected(isSubscribed);

        if (isSubscribed) {
          await channel.track(user);
        }
      });

    channelRef.current = channel;

    return () => {
      isActive = false;
      setConnected(false);
      channelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [
    debugMode,
    onQuickJoinChange,
    onRoomTitleChange,
    onRoomVenueChange,
    onTableShapeChange,
    roomName,
    supabase,
    user
  ]);

  useEffect(() => {
    if (!debugMode) {
      return;
    }

    let messageIndex = 0;
    setConnected(false);
    setRealtimeMode("demo");
    setPresence([]);
    setMessages(
      debugMembers.map((member, index) =>
        createDebugMessage(member, Date.now() - (maxSeatCount - index) * 850, index)
      )
    );

    const timer = window.setInterval(() => {
      const member = debugMembers[messageIndex % debugMembers.length];
      const nextMessage = createDebugMessage(member, Date.now(), messageIndex);
      messageIndex += 1;
      setMessages((current) => mergeMessage(current, nextMessage));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [debugMembers, debugMode]);

  const updateRoomTitle = useCallback((nextValue: string) => {
    if (!canManageRoomSettings) {
      return;
    }

    const nextTitle = nextValue.slice(0, 28);
    setRoomTitle(nextTitle);
    onRoomTitleChange?.(nextTitle);
    void channelRef.current?.send({
      type: "broadcast",
      event: "room_settings",
      payload: { roomTitle: nextTitle }
    });
  }, [canManageRoomSettings, onRoomTitleChange]);

  const updateTableShape = useCallback((nextShape: TableShape) => {
    if (!canManageRoomSettings) {
      return;
    }

    setTableShape(nextShape);
    onTableShapeChange?.(nextShape);
    void channelRef.current?.send({
      type: "broadcast",
      event: "room_settings",
      payload: { tableShape: nextShape }
    });
  }, [canManageRoomSettings, onTableShapeChange]);

  const updateRoomVenue = useCallback((nextVenue: RoomVenue) => {
    if (!canManageRoomSettings) {
      return;
    }

    setRoomVenue(nextVenue);
    onRoomVenueChange?.(nextVenue);
    void channelRef.current?.send({
      type: "broadcast",
      event: "room_settings",
      payload: { roomVenue: nextVenue }
    });
  }, [canManageRoomSettings, onRoomVenueChange]);

  const updateQuickJoin = useCallback((nextValue: boolean) => {
    if (!canManageRoomSettings) {
      return;
    }

    setQuickJoinEnabled(nextValue);
    onQuickJoinChange?.(nextValue);
    void channelRef.current?.send({
      type: "broadcast",
      event: "room_settings",
      payload: { quickJoinEnabled: nextValue }
    });
  }, [canManageRoomSettings, onQuickJoinChange]);

  const resetPaymentSession = useCallback(() => {
    setPaymentVotes({});
    setPaymentParticipants({});
    setPaymentVoteEndsAt(null);
    setPaymentVoteClosedAt(null);
    setFinalPaymentMethod(null);
    setSecretCheckout(null);
    setSecretAmount("");
  }, []);

  const completeSoloOrder = useCallback(() => {
    if (orderTotal <= 0 || walletBalance < orderTotal) {
      return;
    }

    const nextCompletedOrder: CompletedOrder = {
      id: createId(),
      payerNickname: nickname,
      payerRole: selectedRole,
      amount: orderTotal,
      at: Date.now(),
      label: "혼자 주문 완료"
    };

    setWalletBalance((current) => Math.max(0, current - orderTotal));
    setCompletedOrder(nextCompletedOrder);
    resetPaymentSession();
    setOrderChoiceOpen(false);
    setMenuOpen(false);
    setPaymentOpen(false);
    void channelRef.current?.send({
      type: "broadcast",
      event: "order_completed",
      payload: nextCompletedOrder
    });
  }, [nickname, orderTotal, resetPaymentSession, selectedRole, walletBalance]);

  const startTogetherOrder = useCallback(() => {
    if (orderTotal <= 0) {
      return;
    }

    setCompletedOrder(null);
    resetPaymentSession();
    setOrderChoiceOpen(false);
    setMenuOpen(false);
    setPaymentOpen(true);
  }, [orderTotal, resetPaymentSession]);

  const closePaymentVote = useCallback((method: PaymentMethod = winningPaymentMethod.id) => {
    if (paymentVoteClosedAt) {
      return;
    }

    const closedAt = Date.now();
    setFinalPaymentMethod(method);
    setPaymentVoteClosedAt(closedAt);
    setPaymentVoteEndsAt(null);
    void channelRef.current?.send({
      type: "broadcast",
      event: "payment_vote_closed",
      payload: { method, at: closedAt }
    });
  }, [paymentVoteClosedAt, winningPaymentMethod.id]);

  useEffect(() => {
    if (
      !isPaymentOpen ||
      completedOrder ||
      paymentVoteClosedAt ||
      paymentVoteEndsAt ||
      paymentParticipantCount <= 0 ||
      selectedPaymentVoteCount < paymentRequiredVoteCount
    ) {
      return;
    }

    const endsAt = Date.now() + bubbleLifetimeMs;
    setPaymentVoteEndsAt(endsAt);
    void channelRef.current?.send({
      type: "broadcast",
      event: "payment_vote_countdown",
      payload: { endsAt }
    });
  }, [
    completedOrder,
    isPaymentOpen,
    paymentParticipantCount,
    paymentRequiredVoteCount,
    paymentVoteClosedAt,
    paymentVoteEndsAt,
    selectedPaymentVoteCount
  ]);

  useEffect(() => {
    if (!paymentVoteEndsAt || paymentVoteClosedAt || now < paymentVoteEndsAt) {
      return;
    }

    closePaymentVote();
  }, [closePaymentVote, now, paymentVoteClosedAt, paymentVoteEndsAt]);

  const selectMenuItem = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, itemId: string) => {
      const listElement = menuListRef.current;
      const listRect = listElement?.getBoundingClientRect();
      const pointerX = listRect
        ? ((event.clientX - listRect.left) / listRect.width) * 100
        : 50;
      const pointerY = listRect
        ? ((event.clientY - listRect.top) / listRect.height) * 100
        : 50;
      const nextSelection: MenuSelection = {
        id: createId(),
        userId: sessionIdRef.current,
        nickname,
        role: selectedRole,
        itemId,
        x: clampPercent(Math.max(38, pointerX)),
        y: clampPercent(pointerY),
        at: Date.now()
      };

      setCompletedOrder(null);
      setOrderChoiceOpen(false);
      setMenuSelections((current) => ({
        ...current,
        [nextSelection.id]: nextSelection
      }));
      void channelRef.current?.send({
        type: "broadcast",
        event: "menu_selection",
        payload: nextSelection
      });
    },
    [nickname, selectedRole]
  );

  const removeMenuSelection = useCallback((selectionId: string) => {
    setOrderChoiceOpen(false);
    setMenuSelections((current) => {
      const nextSelections = { ...current };
      delete nextSelections[selectionId];
      return nextSelections;
    });
    void channelRef.current?.send({
      type: "broadcast",
      event: "menu_selection_remove",
      payload: { id: selectionId }
    });
  }, []);

  const votePaymentMethod = useCallback(
    (method: PaymentMethod) => {
      if (completedOrder || paymentVoteClosedAt) {
        return;
      }

      const nextVote: PaymentVote = {
        userId: sessionIdRef.current,
        nickname,
        role: selectedRole,
        method,
        at: Date.now()
      };

      setPaymentVotes((current) => ({
        ...current,
        [nextVote.userId]: nextVote
      }));
      void channelRef.current?.send({
        type: "broadcast",
        event: "payment_vote",
        payload: nextVote
      });
    },
    [completedOrder, nickname, paymentVoteClosedAt, selectedRole]
  );

  const claimSecretCheckout = useCallback(() => {
    if (completedOrder) {
      return;
    }

    const nextCheckout: SecretCheckout = {
      userId: sessionIdRef.current,
      nickname,
      role: selectedRole,
      at: Date.now()
    };

    setSecretAmount("");
    setSecretCheckout(nextCheckout);
    void channelRef.current?.send({
      type: "broadcast",
      event: "secret_checkout",
      payload: nextCheckout
    });
  }, [completedOrder, nickname, selectedRole]);

  const completeSecretCheckout = useCallback(() => {
    if (!isSecretCheckoutMine || secretCheckoutAmount <= 0 || secretCheckoutAmount > walletBalance) {
      return;
    }

    const nextCompletedOrder: CompletedOrder = {
      id: createId(),
      payerNickname: nickname,
      payerRole: selectedRole,
      amount: secretCheckoutAmount,
      at: Date.now(),
      label: "몰래 계산 완료"
    };

    setWalletBalance((current) => Math.max(0, current - secretCheckoutAmount));
    setCompletedOrder(nextCompletedOrder);
    setPaymentVotes({});
    setPaymentParticipants({});
    setPaymentVoteEndsAt(null);
    setPaymentVoteClosedAt(null);
    setFinalPaymentMethod(null);
    setSecretCheckout(null);
    void channelRef.current?.send({
      type: "broadcast",
      event: "order_completed",
      payload: nextCompletedOrder
    });
  }, [isSecretCheckoutMine, nickname, secretCheckoutAmount, selectedRole, walletBalance]);

  const sendMessage = useCallback(
    async (body: string, kind: ChatMessage["kind"] = "normal") => {
      const cleanBody = body.trim();

      if (!cleanBody) {
        return;
      }

      const sentAt = Date.now();

      if (cooldownUntil > sentAt) {
        return;
      }

      const nextMessage: ChatMessage = {
        id: createId(),
        nickname,
        role: selectedRole,
        body: cleanBody.slice(0, 120),
        at: sentAt,
        kind
      };

      setCooldownUntil(sentAt + chatCooldownMs);
      setCooldownTick((value) => value + 1);
      keepComposerFocus();

      if (!debugMode && supabase && channelRef.current && connected) {
        setMessages((current) => mergeMessage(current, nextMessage));
        const { error } = await supabase
          .from("hasik_messages")
          .insert({
            id: nextMessage.id,
            room: roomName,
            nickname: nextMessage.nickname,
            role: nextMessage.role,
            body: nextMessage.body,
            kind: nextMessage.kind ?? "normal"
          });

        if (error) {
          setRealtimeMode("setup");
          setMessages((current) => [
            ...current.slice(-79),
            {
              id: createId(),
              nickname: "시스템",
              role: "부장",
              body: "Supabase 테이블 설정이 필요합니다. 데모 메시지로만 표시됩니다.",
              at: Date.now(),
              kind: "system"
            }
          ]);
        }
      } else {
        setMessages((current) => mergeMessage(current, nextMessage));
      }

      setInput("");
      window.requestAnimationFrame(() => {
        keepComposerFocus();
      });
    },
    [
      connected,
      cooldownUntil,
      keepComposerFocus,
      nickname,
      roomName,
      selectedRole,
      supabase,
      debugMode
    ]
  );

  const reportProfile = useCallback(async () => {
    if (!activeProfile) {
      return;
    }

    if (!supabase) {
      setReportStatus("데모 모드에서는 신고가 저장되지 않습니다.");
      return;
    }

    setIsReporting(true);

    const { error } = await supabase.from("hasik_reports").insert({
      room: roomName,
      message_id: activeProfile.id,
      reported_nickname: activeProfile.nickname,
      reported_role: activeProfile.role,
      message_body: activeProfile.body,
      reporter_session_id: sessionIdRef.current
    });

    setIsReporting(false);

    if (error) {
      setReportStatus("신고 저장에 실패했습니다. Supabase 신고 테이블 설정을 확인해주세요.");
      return;
    }

    setReportStatus("신고가 접수됐습니다.");
  }, [activeProfile, roomName, supabase]);

  const renderComposer = (className: string) => {
    return (
      <div className={className}>
        <form
          className="chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
        >
          <button
            type="button"
            className="icon-action"
            title="확성기"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => void sendMessage(`${nickname}님이 확성기를 켰습니다`, "system")}
          >
            <Megaphone size={18} />
          </button>
          <input
            aria-label="채팅 입력"
            maxLength={120}
            placeholder="내 자리에서 한마디"
            value={input}
            ref={(element) => {
              if (element) {
                activeComposerInputRef.current = element;
              }
            }}
            onFocus={(event) => {
              activeComposerInputRef.current = event.currentTarget;
            }}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            className="send-button"
            type="submit"
            title={isCoolingDown ? "잠시 후 보내기" : "보내기"}
            disabled={isCoolingDown || !input.trim()}
            onPointerDown={(event) => event.preventDefault()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    );
  };

  return (
    <main className="room-page min-h-screen bg-[#17120f] text-[#fff8ec]">
      <div className="app-shell">
        <section className="hero-room" aria-label="회식방">
          <div className="topbar">
            <div>
              <h1>{roomTitle || "이름 없는 회식방"}</h1>
            </div>
            <div className="topbar-actions">
              <span className="money-pill topbar-money">내 돈 {formatPrice(walletBalance)}</span>
              {onLeave ? (
                <button type="button" className="leave-room-button" onClick={onLeave}>
                  메인 메뉴
                </button>
              ) : null}
              <button
                type="button"
                className="room-settings-icon-button"
                onClick={() => {
                  if (canManageRoomSettings) {
                    setSettingsOpen(true);
                  }
                }}
                disabled={!canManageRoomSettings}
                title={canManageRoomSettings ? "회식방 설정" : "방장만 설정할 수 있습니다"}
                aria-label="회식방 설정"
              >
                <Settings2 size={20} />
              </button>
            </div>
          </div>

          <div className="room-grid">
            <section className="table-stage" aria-label="가상 테이블">
              <div className="table-scene">
                <div className="room-venue-backdrop" style={venueBackdropStyle} aria-hidden="true" />
                <div className="scene-toolbar">
                  <div className="scene-stats">
                    <span>접속 {onlineCount}명</span>
                    <span className="stat-separator" aria-hidden="true">
                      |
                    </span>
                    <span>누적 착석 {Math.max(stayMinutes, 1)}분</span>
                  </div>
                  <div className="scene-actions">
                    <div className="analog-time" aria-label={`현재 ${formatClock(now)}`}>
                      <div className="analog-clock" style={clockStyle} aria-hidden="true">
                        {clockMarks.map((markAngle) => (
                          <span
                            key={markAngle}
                            className="clock-mark"
                            style={{ "--mark-angle": `${markAngle}deg` } as CSSProperties}
                          />
                        ))}
                        <span className="clock-hand hour-hand" />
                        <span className="clock-hand minute-hand" />
                        <span className="clock-pin" />
                      </div>
                      <span>{formatPeriod(now)}</span>
                    </div>
                  </div>
                </div>
                <div className={`seat-map ${tableShape}`} aria-label="오늘의 자리 배치">
                  <div className={`table ${tableShape}`} />

                  {seatMembers.map((member, index) => {
                    const seatMessage = member
                      ? latestMessageByMember.get(getMemberKey(member.nickname, member.role))
                      : null;
                    const visibleSeatMessage =
                      seatMessage && now - seatMessage.at <= bubbleLifetimeMs ? seatMessage : null;
                    const isMine = member?.id === sessionIdRef.current;

                    return (
                      <div
                        key={member?.id ?? `empty-seat-${index}`}
                        className={[
                          "seat-slot",
                          `slot-${index}`,
                          member ? "occupied" : "empty",
                          isMine ? "mine" : ""
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          className="seat-token"
                          disabled={!visibleSeatMessage}
                          onClick={() => {
                            if (visibleSeatMessage) {
                              setActiveProfile(visibleSeatMessage);
                            }
                          }}
                        >
                          {member ? (
                            <NameWithRole nickname={member.nickname} role={member.role} />
                          ) : (
                            <span>빈자리</span>
                          )}
                          <small>{member ? (isMine ? "내 자리" : "착석 중") : "착석 가능"}</small>
                        </button>
                      </div>
                    );
                  })}

                  <div className="seat-bubble-layer" aria-label="좌석 말풍선">
                    {seatMembers.map((member, index) => {
                      const seatMessage = member
                        ? latestMessageByMember.get(getMemberKey(member.nickname, member.role))
                        : null;
                      const visibleSeatMessage =
                        seatMessage && now - seatMessage.at <= bubbleLifetimeMs ? seatMessage : null;

                      if (!visibleSeatMessage) {
                        return null;
                      }

                      const bubbleStackLevel = Math.max(
                        1,
                        Math.min(
                          bubbleLifetimeMs,
                          Math.round(visibleSeatMessage.at - (now - bubbleLifetimeMs))
                        )
                      );

                      return (
                        <div
                          key={`bubble-${member?.id ?? index}`}
                          className={`seat-bubble-anchor slot-${index}`}
                          style={{ zIndex: bubbleStackLevel }}
                        >
                          <button
                            type="button"
                            className={`seat-bubble ${visibleSeatMessage.kind ?? "normal"}`}
                            onClick={() => setActiveProfile(visibleSeatMessage)}
                          >
                            <span>{visibleSeatMessage.body}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="menu-trigger table-menu-trigger"
                  onClick={() => setMenuOpen(true)}
                  aria-label="메뉴판 열기"
                  title="메뉴판"
                >
                  <img src={menuButtonImage} alt="" draggable={false} />
                </button>
              </div>

            </section>

            <aside className="right-rail" aria-label="채팅 영역">
              <section className="chat-panel" aria-label="실시간 채팅">
                <div className="chat-feed" ref={chatFeedRef}>
                  {visibleMessages.map((message) => (
                    <article key={message.id} className={`chat-message ${message.kind ?? "normal"}`}>
                      <button
                        type="button"
                        className="profile-trigger chat-name"
                        onClick={() => setActiveProfile(message)}
                      >
                        <NameWithRole nickname={message.nickname} role={message.role} />
                      </button>
                      <p>{message.body}</p>
                      <time className="message-time">{formatClock(message.at)}</time>
                    </article>
                  ))}
                </div>

                <div className="chat-header">
                  <p>채팅</p>
                  <button
                    type="button"
                    className="icon-action"
                    title="골든벨"
                    onClick={() => void sendMessage("제가 오늘 제로콜라 쏩니다", "bell")}
                  >
                    <Gift size={19} />
                  </button>
                </div>
              </section>

              {renderComposer("composer-shell docked-composer")}
            </aside>
          </div>
        </section>

      </div>
      {isMenuOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        >
          <section
            className="menu-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-head">
              <div>
                <p id="menu-title">메뉴판</p>
                <span>원하는 메뉴를 눌러 같이 고르기</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setMenuOpen(false)}
                aria-label="메뉴판 닫기"
              >
                ×
              </button>
            </div>

            <div className="menu-list" ref={menuListRef}>
              {menuItems.map((item) => {
                const count = menuSelectionList.filter((selection) => selection.itemId === item.id).length;
                const isSelectedByMe = menuSelectionList.some(
                  (selection) =>
                    selection.userId === sessionIdRef.current && selection.itemId === item.id
                );

                return (
                  <div
                    key={item.id}
                    className={isSelectedByMe ? "menu-row selected" : "menu-row"}
                  >
                    <span className="menu-name">{item.name}</span>
                    <button
                      type="button"
                      className="menu-select-zone"
                      onPointerUp={(event) => selectMenuItem(event, item.id)}
                    >
                      <span className="menu-dots" aria-hidden="true" />
                      <span className="menu-price">{formatPrice(item.price)}</span>
                      <strong className="menu-count">{count > 0 ? count : ""}</strong>
                    </button>
                  </div>
                );
              })}
              {menuSelectionList.map((selection) => {
                const isMine = selection.userId === sessionIdRef.current;
                const pointerStyle = {
                  "--pointer-x": `${selection.x}%`,
                  "--pointer-y": `${selection.y}%`
                } as CSSProperties;

                return isMine ? (
                  <button
                    key={selection.id}
                    type="button"
                    className="menu-pointer mine"
                    style={pointerStyle}
                    title="선택 취소"
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      removeMenuSelection(selection.id);
                    }}
                  >
                    <Pointer size={21} />
                  </button>
                ) : (
                  <span
                    key={selection.id}
                    className="menu-pointer"
                    style={pointerStyle}
                    title={`${selection.nickname} 선택`}
                    aria-hidden="true"
                  >
                    <Pointer size={21} />
                  </span>
                );
              })}
            </div>

            <div className="menu-order-summary">
              {orderedMenuItems.length > 0 ? (
                orderedMenuItems.map((item) => (
                  <span key={item.id}>
                    {item.name} {item.count}
                  </span>
                ))
              ) : (
                <span>아직 선택된 메뉴가 없습니다</span>
              )}
            </div>

            <div className="menu-order-bar">
              {orderedMenuItems.length > 0 ? <span>합계 {formatPrice(orderTotal)}</span> : null}
              <button
                type="button"
                className="order-button"
                disabled={orderedMenuItems.length === 0}
                onClick={() => setOrderChoiceOpen((value) => !value)}
              >
                주문하기
              </button>
            </div>

            {isOrderChoiceOpen ? (
              <div className="order-choice-panel">
                <span className="money-pill">내 돈 {formatPrice(walletBalance)}</span>
                <div className="order-choice-actions">
                  <button
                    type="button"
                    className="order-choice-button"
                    disabled={orderTotal <= 0 || walletBalance < orderTotal}
                    onClick={completeSoloOrder}
                  >
                    혼자 주문
                  </button>
                  <button
                    type="button"
                    className="order-choice-button"
                    disabled={orderTotal <= 0}
                    onClick={startTogetherOrder}
                  >
                    함께 주문
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {isPaymentOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setPaymentOpen(false)}
        >
          <section
            className="payment-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-head">
              <div>
                <p id="payment-title">결제 수단 투표</p>
                <span>
                  현재 1위 {winningPaymentMethod.label} · {winningPaymentMethod.count}표
                </span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setPaymentOpen(false)}
                aria-label="결제 투표 닫기"
              >
                ×
              </button>
            </div>

            <div className="ordered-list">
              {orderedMenuItems.map((item) => (
                <div key={item.id}>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              <div>
                <span>합계</span>
                <strong>{formatPrice(orderTotal)}</strong>
              </div>
            </div>

            <div className="payment-status-row">
              <span className="money-pill">내 돈 {formatPrice(walletBalance)}</span>
              <span className="payment-status-text">
                {paymentVoteClosedAt && finalPaymentOption
                  ? `투표 종료 · ${finalPaymentOption.label}`
                  : paymentVoteRemainingSeconds !== null
                    ? `${paymentVoteRemainingSeconds}초 뒤 자동 종료`
                    : `${paymentParticipantCount}명 중 ${selectedPaymentVoteCount}명 선택 · 과반 ${paymentRequiredVoteCount}명`}
              </span>
            </div>

            {completedOrder ? (
              <div className="order-complete">
                <strong>
                  <NameWithRole
                    nickname={completedOrder.payerNickname}
                    role={completedOrder.payerRole}
                  />{" "}
                  {completedOrder.label ?? "계산 완료"}
                </strong>
                <span>{formatPrice(completedOrder.amount)}</span>
              </div>
            ) : (
              <>
                <div className="payment-options">
                  {paymentVoteCounts.map((option) => {
                    const Icon = option.icon;
                    const isSelected = paymentVotes[sessionIdRef.current]?.method === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={isSelected ? "payment-option selected" : "payment-option"}
                        disabled={Boolean(paymentVoteClosedAt)}
                        onClick={() => votePaymentMethod(option.id)}
                      >
                        <Icon size={19} />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.description}</small>
                        </span>
                        <em>{option.count}</em>
                      </button>
                    );
                  })}
                </div>

                <div className="secret-checkout">
                  {isSecretCheckoutMine ? (
                    <form
                      className="secret-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        completeSecretCheckout();
                      }}
                    >
                      <input
                        inputMode="numeric"
                        aria-label="몰래 계산 금액"
                        placeholder="합계 금액"
                        value={secretAmount}
                        onChange={(event) => setSecretAmount(event.target.value)}
                      />
                      <button
                        type="submit"
                        className="secret-pay-button"
                        disabled={secretCheckoutAmount <= 0 || secretCheckoutAmount > walletBalance}
                      >
                        결제
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="secret-claim-button"
                      onClick={claimSecretCheckout}
                    >
                      {secretCheckout ? "막고 내가 계산" : "몰래 계산"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
      {isSettingsOpen ? (
        <div
          className="profile-backdrop"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <section
            className="settings-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-head">
              <div>
                <p id="settings-title">회식방 설정</p>
                <span>방장 전용</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setSettingsOpen(false)}
                aria-label="설정 닫기"
              >
                ×
              </button>
            </div>

            <div className="settings-section">
              <span>회식방 이름</span>
              <input
                aria-label="회식방 이름"
                maxLength={28}
                value={roomTitle}
                onChange={(event) => updateRoomTitle(event.target.value)}
              />
            </div>

            <div className="settings-section">
              <span>테이블</span>
              <div className="table-shape-list settings-options">
                <button
                  type="button"
                  className={tableShape === "round" ? "shape-chip selected" : "shape-chip"}
                  onClick={() => updateTableShape("round")}
                >
                  원탁
                </button>
                <button
                  type="button"
                  className={tableShape === "rectangle" ? "shape-chip selected" : "shape-chip"}
                  onClick={() => updateTableShape("rectangle")}
                >
                  직사각형
                </button>
              </div>
            </div>

            <div className="settings-section">
              <span>장소</span>
              <div className="venue-list settings-options">
                {roomVenues.map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    className={roomVenue === venue.id ? "shape-chip selected" : "shape-chip"}
                    onClick={() => updateRoomVenue(venue.id)}
                  >
                    {venue.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <span>빠른입장</span>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={quickJoinEnabled}
                  onChange={(event) => updateQuickJoin(event.target.checked)}
                />
                <span>빠른입장 허용</span>
              </label>
            </div>
          </section>
        </div>
      ) : null}
      {activeProfile ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setActiveProfile(null)}
        >
          <section
            className="profile-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-head">
              <div className="profile-avatar" aria-hidden="true">
                <UserRound size={24} />
              </div>
              <div>
                <p id="profile-title">
                  <NameWithRole nickname={activeProfile.nickname} role={activeProfile.role} />
                </p>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setActiveProfile(null)}
                aria-label="프로필 닫기"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              className="report-button"
              onClick={() => void reportProfile()}
              disabled={isReporting}
            >
              <Flag size={18} />
              {isReporting ? "신고 접수 중" : "이 사용자 신고"}
            </button>
            {reportStatus ? <p className="report-status">{reportStatus}</p> : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

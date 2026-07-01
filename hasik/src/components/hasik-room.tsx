"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentType,
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Flag,
  Hand,
  HandFist,
  Megaphone,
  Pointer,
  ReceiptText,
  Send,
  Settings2,
  UserRound
} from "lucide-react";
import { getHasikRoomName, getSupabaseBrowserClient } from "@/lib/supabase";
import {
  defaultWalletBalance,
  getSavedWalletState,
  getWalletResetAt,
  saveWalletState
} from "@/lib/wallet";

type Role = "인턴" | "사원" | "대리" | "과장" | "부장";
type Mood = "quiet" | "talk" | "afterwork";
type RealtimeMode = "demo" | "setup" | "live";
type RpsChoice = "scissors" | "rock" | "paper";
export type TableShape = "round" | "rectangle";
export type RoomVenue = "a" | "b" | "c";
type RpsIconProps = {
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
};
type RpsIcon = ComponentType<RpsIconProps>;

interface HasikRoomProps {
  initialRoomTitle?: string;
  initialRoomCreatedAt?: number;
  initialTotalPaymentAmount?: number;
  initialTableShape?: TableShape;
  initialRoomVenue?: RoomVenue;
  canManageRoomSettings?: boolean;
  debugMode?: boolean;
  roomNameOverride?: string;
  onLeave?: () => void;
  onRoomTitleChange?: (title: string) => void;
  onTableShapeChange?: (shape: TableShape) => void;
  onRoomVenueChange?: (venue: RoomVenue) => void;
  onOrderCompleted?: (amount: number) => void;
}

interface ChatMessage {
  id: string;
  nickname: string;
  role: Role;
  body: string;
  at: number;
  kind?: "normal" | "system" | "bell" | "rps";
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

interface CompletedOrder {
  id: string;
  payerNickname: string;
  payerRole: Role;
  amount: number;
  at: number;
  label?: string;
  summary?: string;
  detail?: string;
  method?: "rps";
}

interface PaymentParticipant {
  userId: string;
  nickname: string;
  role: Role;
  at: number;
}

interface RpsPlayer {
  userId: string;
  nickname: string;
  role: Role;
  choice: RpsChoice | null;
  score: number;
  status: "active" | "winner" | "payer";
}

interface RpsRound {
  players: RpsPlayer[];
  activeUserIds: string[];
  roundNumber: number;
  message: string;
  payerUserId?: string;
  needsReplay: boolean;
}

interface SignaturePoint {
  x: number;
  y: number;
}

type SignatureStroke = SignaturePoint[];

interface ReceiptLine {
  itemId?: string;
  name: string;
  count: number;
  amount: number;
  icon?: string;
}

interface ServedDish {
  id: string;
  name: string;
  count: number;
  icon: string;
  slotIndex: number;
  placedAt: number;
}

interface ApprovedReceipt {
  id: string;
  payerNickname: string;
  payerRole: Role;
  amount: number;
  at: number;
  items: ReceiptLine[];
  signatureStrokes: SignatureStroke[];
}

const chatCooldownMs = 500;
const megaphoneStorageKey = "hasik:megaphone-count";
const megaphonePrice = 10000;
const rpsRoundDurationMs = 15000;
const rpsResultHoldMs = 4000;
const rpsWinnerFadeMs = 1250;
const rpsPostFadeWaitMs = 3000;
const roles: Role[] = ["인턴", "사원", "대리", "과장", "부장"];
const menuItems = [
  { id: "steamed-clam-platter", name: "조개모듬찜", price: 50000, kind: "food", icon: "조개" },
  { id: "grilled-mackerel", name: "고등어구이", price: 20000, kind: "food", icon: "고등어" },
  { id: "spicy-pork", name: "제육볶음", price: 20000, kind: "food", icon: "제육" },
  { id: "pork-skin", name: "돼지껍데기", price: 10000, kind: "food", icon: "껍데기" },
  { id: "live-octopus", name: "산낙지", price: 20000, kind: "food", icon: "낙지" },
  { id: "rolled-omelet", name: "계란말이", price: 10000, kind: "food", icon: "계란" },
  { id: "ramyeon", name: "라면", price: 5000, kind: "food", icon: "라면" },
  { id: "kimchi-jeon", name: "김치전", price: 10000, kind: "food", icon: "전" },
  { id: "soju", name: "소주", price: 6000, kind: "drink", icon: "소주" },
  { id: "makgeolli", name: "막걸리", price: 5000, kind: "drink", icon: "막걸리" },
  { id: "draft-beer", name: "생맥주", price: 5000, kind: "drink", icon: "맥주" },
  { id: "cola", name: "콜라", price: 2000, kind: "drink", icon: "콜라" },
  { id: "cider", name: "사이다", price: 2000, kind: "drink", icon: "사이다" },
  { id: "oolong-tea", name: "우롱차", price: 3000, kind: "drink", icon: "차" }
] as const;

function ScissorsHandIcon({ size = 24, className }: RpsIconProps) {
  const iconSize = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      className={["rps-generated-scissors", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      style={{
        width: iconSize,
        height: iconSize,
        "--rps-scissors-icon": `url("${getAssetPath("/assets/hasik/rps-scissors-hand.png")}")`
      } as CSSProperties}
    />
  );
}

const rpsChoices: Array<{ id: RpsChoice; label: string; icon: RpsIcon }> = [
  { id: "scissors", label: "가위", icon: ScissorsHandIcon },
  { id: "rock", label: "바위", icon: HandFist },
  { id: "paper", label: "보", icon: Hand }
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
const servedDishSlots: Record<TableShape, Array<{ x: number; y: number }>> = {
  round: [
    { x: 50, y: 50 },
    { x: 42, y: 43 },
    { x: 58, y: 43 },
    { x: 43, y: 57 },
    { x: 57, y: 57 },
    { x: 50, y: 37 },
    { x: 35, y: 50 },
    { x: 65, y: 50 }
  ],
  rectangle: [
    { x: 50, y: 50 },
    { x: 42, y: 45 },
    { x: 58, y: 45 },
    { x: 42, y: 55 },
    { x: 58, y: 55 },
    { x: 34, y: 50 },
    { x: 66, y: 50 },
    { x: 50, y: 38 }
  ]
};

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

function getSavedMegaphoneCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const savedCount = Number(localStorage.getItem(megaphoneStorageKey));

    if (Number.isFinite(savedCount) && savedCount >= 0) {
      return Math.floor(savedCount);
    }
  } catch {
    return 0;
  }

  return 0;
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

function compareRps(left: RpsChoice, right: RpsChoice) {
  if (left === right) {
    return 0;
  }

  if (
    (left === "scissors" && right === "paper") ||
    (left === "rock" && right === "scissors") ||
    (left === "paper" && right === "rock")
  ) {
    return 1;
  }

  return -1;
}

function createSeededChoice(userId: string, roundNumber: number): RpsChoice {
  const seed = `${userId}:${roundNumber}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return rpsChoices[hash % rpsChoices.length].id;
}

function createSignaturePath(points: SignatureStroke) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}

function createPaymentParticipant(member: PresenceUser): PaymentParticipant {
  return {
    userId: member.id,
    nickname: member.nickname,
    role: member.role,
    at: Date.now()
  };
}

function getReceiptLineIcon(line: ReceiptLine) {
  return line.icon ?? menuItems.find((item) => item.id === line.itemId || item.name === line.name)?.icon ?? "메뉴";
}

function formatDuration(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0 && restMinutes > 0) {
    return `${hours}시간 ${restMinutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${Math.max(minutes, 1)}분`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getMemberKey(nickname: string, role: Role) {
  return `${nickname}:${role}`;
}

function stripRoleSuffix(nickname: string, role: Role) {
  const baseName = nickname.replace(/익명\d+$/, "");
  return baseName.endsWith(role) ? baseName.slice(0, -role.length) || baseName : baseName;
}

function formatMemberName(nickname: string, role: Role) {
  return `${stripRoleSuffix(nickname, role)}${role}`;
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
  initialRoomCreatedAt = Date.now(),
  initialTotalPaymentAmount = 0,
  initialTableShape = "round",
  initialRoomVenue = "a",
  canManageRoomSettings = false,
  debugMode = false,
  roomNameOverride,
  onLeave,
  onRoomTitleChange,
  onTableShapeChange,
  onRoomVenueChange,
  onOrderCompleted
}: HasikRoomProps = {}) {
  const selectedRole: Role = "대리";
  const mood: Mood = "afterwork";
  const [nickname] = useState(() => createAnonymousNickname(selectedRole));
  const [roomTitle, setRoomTitle] = useState(initialRoomTitle);
  const [roomCreatedAt] = useState(initialRoomCreatedAt);
  const [tableShape, setTableShape] = useState<TableShape>(initialTableShape);
  const [roomVenue, setRoomVenue] = useState<RoomVenue>(initialRoomVenue);
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
  const [walletBalance, setWalletBalance] = useState(() => getSavedWalletState().balance);
  const [walletResetAt, setWalletResetAt] = useState(() => getSavedWalletState().resetAt);
  const [isMegaphoneOpen, setMegaphoneOpen] = useState(false);
  const [megaphoneInput, setMegaphoneInput] = useState("");
  const [megaphoneCount, setMegaphoneCount] = useState(getSavedMegaphoneCount);
  const [promotedBubbleId, setPromotedBubbleId] = useState<string | null>(null);
  const [menuSelections, setMenuSelections] = useState<Record<string, MenuSelection>>({});
  const [servedDishes, setServedDishes] = useState<ServedDish[]>([]);
  const [paymentParticipants, setPaymentParticipants] = useState<Record<string, PaymentParticipant>>({});
  const [rpsActiveUserIds, setRpsActiveUserIds] = useState<string[]>([]);
  const [rpsRoundNumber, setRpsRoundNumber] = useState(1);
  const [rpsRoundEndsAt, setRpsRoundEndsAt] = useState<number | null>(null);
  const [rpsSelections, setRpsSelections] = useState<Record<string, RpsChoice>>({});
  const [rpsRound, setRpsRound] = useState<RpsRound | null>(null);
  const [pendingPayer, setPendingPayer] = useState<PaymentParticipant | null>(null);
  const [isSignatureOpen, setSignatureOpen] = useState(false);
  const [signatureStrokes, setSignatureStrokes] = useState<SignatureStroke[]>([]);
  const [currentSignatureStroke, setCurrentSignatureStroke] = useState<SignatureStroke | null>(null);
  const [approvedReceipts, setApprovedReceipts] = useState<ApprovedReceipt[]>([]);
  const [isReceiptListOpen, setReceiptListOpen] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<ApprovedReceipt | null>(null);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);
  const [totalPaymentAmount, setTotalPaymentAmount] = useState(initialTotalPaymentAmount);
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
  const orderChoicePanelRef = useRef<HTMLDivElement | null>(null);
  const activeComposerInputRef = useRef<HTMLInputElement | null>(null);
  const completedOrderIdsRef = useRef(new Set<string>());
  const approvedReceiptIdsRef = useRef(new Set<string>());
  const nextRpsRoundTimerRef = useRef<number | null>(null);
  const rpsProgressMessageIdsRef = useRef(new Set<string>());

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const roomName = useMemo(() => roomNameOverride ?? getHasikRoomName(), [roomNameOverride]);
  const roomElapsedMinutes = Math.max(1, Math.floor((now - roomCreatedAt) / 60000));
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
  const receiptLines = useMemo<ReceiptLine[]>(
    () =>
      orderedMenuItems.map((item) => ({
        itemId: item.id,
        name: item.name,
        count: item.count,
        amount: item.price * item.count,
        icon: item.icon
      })),
    [orderedMenuItems]
  );
  const visibleSignatureStrokes = useMemo(
    () => [
      ...signatureStrokes,
      ...(currentSignatureStroke && currentSignatureStroke.length > 0 ? [currentSignatureStroke] : [])
    ],
    [currentSignatureStroke, signatureStrokes]
  );
  const hasSignatureStroke = visibleSignatureStrokes.length > 0;
  const paymentParticipantList = useMemo(
    () => Object.values(paymentParticipants),
    [paymentParticipants]
  );
  const paymentParticipantCount = paymentParticipantList.length;
  const rpsRemainingSeconds = rpsRoundEndsAt
    ? Math.max(0, Math.ceil((rpsRoundEndsAt - now) / 1000))
    : null;
  const selectedRpsChoice = rpsSelections[sessionIdRef.current] ?? null;
  const selectedVenue = roomVenues.find((venue) => venue.id === roomVenue) ?? roomVenues[0];
  const venueBackdropStyle = {
    "--room-venue-image": `url("${getAssetPath(selectedVenue.image)}")`
  } as CSSProperties;
  const menuButtonImage = getAssetPath("/assets/hasik/menu-clipboard.png");

  useEffect(() => {
    if (!isOrderChoiceOpen) {
      return;
    }

    const scrollFrame = window.requestAnimationFrame(() => {
      orderChoicePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [isOrderChoiceOpen]);
  const servedDishSlotList = servedDishSlots[tableShape];

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
  const fallbackPaymentParticipant = useMemo(() => createPaymentParticipant(user), [user]);
  const paymentPlayerList = useMemo(
    () => (paymentParticipantList.length > 0 ? paymentParticipantList : [fallbackPaymentParticipant]),
    [fallbackPaymentParticipant, paymentParticipantList]
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

  const placeReceiptItemsOnTable = useCallback((items: ReceiptLine[]) => {
    const displayItems = items.filter((item) => item.count > 0);

    if (displayItems.length <= 0) {
      return;
    }

    const slots = servedDishSlots[tableShape];

    setServedDishes((current) => {
      const occupiedSlots = new Set(current.map((dish) => dish.slotIndex));
      const nextDishes = [...current];

      displayItems.forEach((item, index) => {
        const emptySlotIndex = slots.findIndex((_slot, slotIndex) => !occupiedSlots.has(slotIndex));
        const slotIndex = emptySlotIndex >= 0
          ? emptySlotIndex
          : (current.length + index) % slots.length;
        const replacedIndex = nextDishes.findIndex((dish) => dish.slotIndex === slotIndex);

        if (replacedIndex >= 0) {
          nextDishes.splice(replacedIndex, 1);
        }

        occupiedSlots.add(slotIndex);
        nextDishes.push({
          id: `${Date.now()}-${item.name}-${slotIndex}-${index}`,
          name: item.name,
          count: item.count,
          icon: getReceiptLineIcon(item),
          slotIndex,
          placedAt: Date.now() + index
        });
      });

      return nextDishes
        .sort((left, right) => left.placedAt - right.placedAt)
        .slice(-slots.length);
    });
  }, [tableShape]);

  const registerCompletedPayment = useCallback((order: CompletedOrder) => {
    if (completedOrderIdsRef.current.has(order.id)) {
      return;
    }

    completedOrderIdsRef.current.add(order.id);
    setTotalPaymentAmount((current) => current + order.amount);
    onOrderCompleted?.(order.amount);
  }, [onOrderCompleted]);

  const registerApprovedReceipt = useCallback((receipt: ApprovedReceipt) => {
    if (approvedReceiptIdsRef.current.has(receipt.id)) {
      return;
    }

    approvedReceiptIdsRef.current.add(receipt.id);
    setApprovedReceipts((current) => [receipt, ...current].slice(0, 30));
    setLatestReceipt(receipt);
    placeReceiptItemsOnTable(receipt.items);
  }, [placeReceiptItemsOnTable]);

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
    if (!latestReceipt) {
      return;
    }

    const timer = window.setTimeout(() => setLatestReceipt(null), 5200);
    return () => window.clearTimeout(timer);
  }, [latestReceipt]);

  useEffect(() => {
    saveWalletState(walletBalance, walletResetAt);
  }, [walletBalance, walletResetAt]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const nextResetAt = getWalletResetAt(now);

    if (nextResetAt !== walletResetAt) {
      setWalletResetAt(nextResetAt);
      setWalletBalance(defaultWalletBalance);
    }
  }, [hasMounted, now, walletResetAt]);

  useEffect(() => {
    try {
      localStorage.setItem(megaphoneStorageKey, String(megaphoneCount));
    } catch {
      return;
    }
  }, [megaphoneCount]);

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
    if (!promotedBubbleId) {
      return;
    }

    if (!visibleMessages.some((message) => message.id === promotedBubbleId)) {
      setPromotedBubbleId(null);
    }
  }, [promotedBubbleId, visibleMessages]);

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

    if (debugMode) {
      const debugParticipants = Object.fromEntries(
        debugMembers.map((member) => [member.id, createPaymentParticipant(member)])
      );

      setPaymentParticipants(debugParticipants);

      return () => {
        setPaymentParticipants({});
      };
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
  }, [completedOrder, debugMembers, debugMode, isPaymentOpen, nickname, selectedRole]);

  useEffect(() => {
    return () => {
      if (nextRpsRoundTimerRef.current) {
        window.clearTimeout(nextRpsRoundTimerRef.current);
      }
    };
  }, []);

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
      .on("broadcast", { event: "rps_progress" }, ({ payload }) => {
        if (
          typeof payload?.id !== "string" ||
          typeof payload?.body !== "string" ||
          typeof payload?.at !== "number"
        ) {
          return;
        }

        const nextMessage: ChatMessage = {
          id: payload.id,
          nickname: "가위바위보",
          role: "부장",
          body: payload.body.slice(0, 120),
          at: payload.at,
          kind: "rps"
        };

        rpsProgressMessageIdsRef.current.add(nextMessage.id);
        setMessages((current) => mergeMessage(current, nextMessage));
      })
      .on("broadcast", { event: "rps_choice" }, ({ payload }) => {
        if (
          typeof payload?.userId !== "string" ||
          typeof payload?.choice !== "string" ||
          typeof payload?.roundNumber !== "number" ||
          payload.roundNumber !== rpsRoundNumber ||
          !rpsChoices.some((choice) => choice.id === payload.choice)
        ) {
          return;
        }

        setRpsSelections((current) => ({
          ...current,
          [payload.userId]: payload.choice as RpsChoice
        }));
      })
      .on("broadcast", { event: "receipt_approved" }, ({ payload }) => {
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

        const rawItems = Array.isArray(payload.items)
          ? payload.items as Array<Record<string, unknown>>
          : [];
        const items: ReceiptLine[] = rawItems
          .filter((item) =>
            typeof item.name === "string" &&
            typeof item.count === "number" &&
            typeof item.amount === "number"
          )
          .map((item) => ({
            name: item.name as string,
            count: item.count as number,
            amount: item.amount as number,
            itemId: typeof item.itemId === "string" ? item.itemId as string : undefined,
            icon: typeof item.icon === "string" ? item.icon as string : undefined
          }));
        const rawStrokes = Array.isArray(payload.signatureStrokes)
          ? payload.signatureStrokes as unknown[]
          : [];
        const signatureStrokes: SignatureStroke[] = rawStrokes
          .filter((stroke): stroke is Array<Record<string, unknown>> => Array.isArray(stroke))
          .map((stroke) =>
            stroke
              .filter((point) => typeof point.x === "number" && typeof point.y === "number")
              .map((point) => ({ x: point.x as number, y: point.y as number }))
          )
          .filter((stroke) => stroke.length > 0);

        registerApprovedReceipt({
          id: payload.id,
          payerNickname: payload.payerNickname,
          payerRole: payload.payerRole as Role,
          amount: payload.amount,
          at: payload.at,
          items,
          signatureStrokes
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

        const nextCompletedOrder = {
          id: payload.id,
          payerNickname: payload.payerNickname,
          payerRole: payload.payerRole as Role,
          amount: payload.amount,
          at: payload.at,
          label: typeof payload?.label === "string" ? payload.label : undefined,
          summary: typeof payload?.summary === "string" ? payload.summary : undefined,
          detail: typeof payload?.detail === "string" ? payload.detail : undefined,
          method: payload?.method === "rps" ? "rps" as const : undefined
        };

        setCompletedOrder(nextCompletedOrder);
        registerCompletedPayment(nextCompletedOrder);
        setPaymentParticipants({});
        if (nextCompletedOrder.method !== "rps") {
          setRpsRound(null);
        }
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
    registerApprovedReceipt,
    registerCompletedPayment,
    onRoomTitleChange,
    onRoomVenueChange,
    onTableShapeChange,
    roomName,
    rpsRoundNumber,
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
    setMenuSelections(
      Object.fromEntries(
        debugMembers.slice(0, 4).map((member, index) => {
          const item = menuItems[index % menuItems.length];
          const selection: MenuSelection = {
            id: `debug-menu-${member.id}-${item.id}`,
            userId: member.id,
            nickname: member.nickname,
            role: member.role,
            itemId: item.id,
            x: 44 + index * 12,
            y: 22 + index * 14,
            at: Date.now() - index * 800
          };

          return [selection.id, selection];
        })
      )
    );
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

  const resetPaymentSession = useCallback(() => {
    setPaymentParticipants({});
    setRpsActiveUserIds([]);
    setRpsRoundNumber(1);
    setRpsRoundEndsAt(null);
    setRpsSelections({});
    setRpsRound(null);
    setPendingPayer(null);
    setSignatureOpen(false);
    setSignatureStrokes([]);
    setCurrentSignatureStroke(null);
    if (nextRpsRoundTimerRef.current) {
      window.clearTimeout(nextRpsRoundTimerRef.current);
      nextRpsRoundTimerRef.current = null;
    }
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
    registerCompletedPayment(nextCompletedOrder);
    resetPaymentSession();
    setOrderChoiceOpen(false);
    setMenuOpen(false);
    setPaymentOpen(false);
    void channelRef.current?.send({
      type: "broadcast",
      event: "order_completed",
      payload: nextCompletedOrder
    });
  }, [nickname, orderTotal, registerCompletedPayment, resetPaymentSession, selectedRole, walletBalance]);

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

  const completeResolvedPayment = useCallback((
    nextCompletedOrder: CompletedOrder,
    walletChargeAmount = 0
  ) => {
    if (orderTotal <= 0) {
      return;
    }

    if (walletChargeAmount > 0 && walletBalance < walletChargeAmount) {
      return;
    }

    if (walletChargeAmount > 0) {
      setWalletBalance((current) => Math.max(0, current - walletChargeAmount));
    }

    setCompletedOrder(nextCompletedOrder);
    registerCompletedPayment(nextCompletedOrder);
    void channelRef.current?.send({
      type: "broadcast",
      event: "order_completed",
      payload: nextCompletedOrder
    });
  }, [orderTotal, registerCompletedPayment, walletBalance]);

  const postRpsProgressMessage = useCallback((id: string, body: string) => {
    if (rpsProgressMessageIdsRef.current.has(id)) {
      return;
    }

    rpsProgressMessageIdsRef.current.add(id);
    const nextMessage: ChatMessage = {
      id,
      nickname: "가위바위보",
      role: "부장",
      body: body.slice(0, 120),
      at: Date.now(),
      kind: "rps"
    };

    setMessages((current) => mergeMessage(current, nextMessage));

    if (!debugMode && connected && channelRef.current) {
      void channelRef.current.send({
        type: "broadcast",
        event: "rps_progress",
        payload: {
          id: nextMessage.id,
          body: nextMessage.body,
          at: nextMessage.at
        }
      });
    }
  }, [connected, debugMode]);

  const startRpsRound = useCallback((activeUserIds: string[], roundNumber: number) => {
    if (activeUserIds.length <= 0) {
      return;
    }

    if (nextRpsRoundTimerRef.current) {
      window.clearTimeout(nextRpsRoundTimerRef.current);
      nextRpsRoundTimerRef.current = null;
    }

    setRpsActiveUserIds(activeUserIds);
    setRpsRoundNumber(roundNumber);
    setRpsRoundEndsAt(Date.now() + rpsRoundDurationMs);
    setRpsSelections({});
    setRpsRound(null);
    postRpsProgressMessage(
      `rps:${roomName}:${roundNumber}:start:${activeUserIds.join("-")}`,
      `${roundNumber}라운드 시작. ${activeUserIds.length}명 참가 중, 15초 안에 선택하세요.`
    );
  }, [postRpsProgressMessage, roomName]);

  const resolveRpsRound = useCallback((currentSelections: Record<string, RpsChoice>) => {
    if (rpsActiveUserIds.length <= 0 || paymentPlayerList.length <= 0 || pendingPayer) {
      return;
    }

    if (nextRpsRoundTimerRef.current) {
      window.clearTimeout(nextRpsRoundTimerRef.current);
      nextRpsRoundTimerRef.current = null;
    }

    const activeUserIdSet = new Set(rpsActiveUserIds);
    const activeParticipants = paymentPlayerList.filter((participant) =>
      activeUserIdSet.has(participant.userId)
    );
    const safeActiveParticipants =
      activeParticipants.length > 0 ? activeParticipants : paymentPlayerList;
    const roundSelections = { ...currentSelections };

    if (safeActiveParticipants.length === 1) {
      const payer = safeActiveParticipants[0];
      const payerName = formatMemberName(payer.nickname, payer.role);

      setRpsRound({
        players: safeActiveParticipants.map((participant) => ({
          userId: participant.userId,
          nickname: participant.nickname,
          role: participant.role,
          choice: roundSelections[participant.userId] ?? createSeededChoice(participant.userId, rpsRoundNumber),
          score: 0,
          status: "payer"
        })),
        activeUserIds: [payer.userId],
        roundNumber: rpsRoundNumber,
        message: `${payerName} 최종 결제`,
        payerUserId: payer.userId,
        needsReplay: false
      });
      setRpsRoundEndsAt(null);
      setPendingPayer(payer);
      postRpsProgressMessage(
        `rps:${roomName}:${rpsRoundNumber}:solo-payer:${payer.userId}`,
        `${rpsRoundNumber}라운드 결과. ${payerName} 결제자로 확정됐습니다.`
      );
      return;
    }

    const playerChoices = safeActiveParticipants.map((participant) => ({
      userId: participant.userId,
      nickname: participant.nickname,
      role: participant.role,
      choice: roundSelections[participant.userId] ?? createSeededChoice(participant.userId, rpsRoundNumber),
      score: 0,
      status: "active" as const
    }));
    const scoredPlayers = playerChoices.map((player) => ({
      ...player,
      score: playerChoices.reduce(
        (score, opponent) => score + compareRps(player.choice, opponent.choice),
        0
      )
    }));
    const scoreSet = new Set(scoredPlayers.map((player) => player.score));
    let nextActiveUserIds = scoredPlayers.map((player) => player.userId);
    let payer: RpsPlayer | null = null;
    const winnerUserIds = new Set<string>();
    let message = "무승부입니다. 다시 가위바위보하세요.";
    let needsReplay = true;

    if (scoreSet.size > 1) {
      const lowestScore = Math.min(...scoredPlayers.map((player) => player.score));
      const losingPlayers = scoredPlayers.filter((player) => player.score === lowestScore);
      scoredPlayers
        .filter((player) => player.score > lowestScore)
        .forEach((player) => winnerUserIds.add(player.userId));

      if (losingPlayers.length === 1) {
        payer = losingPlayers[0];
        nextActiveUserIds = [payer.userId];
        message = `${formatMemberName(payer.nickname, payer.role)} 최종 결제`;
        needsReplay = false;
      } else if (losingPlayers.length < scoredPlayers.length) {
        nextActiveUserIds = losingPlayers.map((player) => player.userId);
        message = `${losingPlayers.length}명이 결제 후보로 남았습니다. 다시 가위바위보하세요.`;
      }
    }
    const nextActiveUserIdSet = new Set(nextActiveUserIds);
    const nextPlayers: RpsPlayer[] = scoredPlayers.map((player) => ({
      ...player,
      status: payer?.userId === player.userId
        ? "payer"
        : winnerUserIds.has(player.userId)
          ? "winner"
          : nextActiveUserIdSet.has(player.userId)
            ? "active"
            : "winner"
    }));

    setRpsRound({
      players: nextPlayers,
      activeUserIds: nextActiveUserIds,
      roundNumber: rpsRoundNumber,
      message,
      payerUserId: payer?.userId,
      needsReplay
    });
    setRpsRoundEndsAt(null);
    setRpsSelections(roundSelections);

    if (payer) {
      const payerParticipant =
        paymentPlayerList.find((participant) => participant.userId === payer?.userId) ?? null;
      setPendingPayer(payerParticipant);
      postRpsProgressMessage(
        `rps:${roomName}:${rpsRoundNumber}:final:${payer.userId}`,
        `${rpsRoundNumber}라운드 결과. ${formatMemberName(payer.nickname, payer.role)} 결제자로 확정됐습니다.`
      );
      return;
    }

    const fadingWinners = nextPlayers.filter((player) => player.status === "winner");
    const resultBody = fadingWinners.length > 0
      ? `${rpsRoundNumber}라운드 결과. ${fadingWinners.map((player) =>
        formatMemberName(player.nickname, player.role)
      ).join(", ")} 통과. ${nextActiveUserIds.length}명 결제 후보 남음.`
      : `${rpsRoundNumber}라운드 결과. 무승부입니다. 전원 다시 선택합니다.`;
    const nextRoundDelay =
      rpsResultHoldMs +
      (fadingWinners.length > 0 ? rpsWinnerFadeMs + rpsPostFadeWaitMs : 0) +
      180;

    postRpsProgressMessage(`rps:${roomName}:${rpsRoundNumber}:result`, resultBody);

    nextRpsRoundTimerRef.current = window.setTimeout(() => {
      startRpsRound(nextActiveUserIds, rpsRoundNumber + 1);
    }, nextRoundDelay);
  }, [
    paymentPlayerList,
    pendingPayer,
    postRpsProgressMessage,
    roomName,
    rpsActiveUserIds,
    rpsRoundNumber,
    startRpsRound
  ]);

  const submitRpsChoice = useCallback((choice: RpsChoice) => {
    if (!rpsRoundEndsAt || !rpsActiveUserIds.includes(sessionIdRef.current) || pendingPayer) {
      return;
    }

    const nextSelections: Record<string, RpsChoice> = {
      [sessionIdRef.current]: choice
    };

    if (debugMode) {
      rpsActiveUserIds.forEach((userId) => {
        if (userId !== sessionIdRef.current) {
          nextSelections[userId] = createSeededChoice(userId, rpsRoundNumber);
        }
      });
    }

    setRpsSelections((current) => ({
      ...current,
      ...nextSelections
    }));

    void channelRef.current?.send({
      type: "broadcast",
      event: "rps_choice",
      payload: {
        userId: sessionIdRef.current,
        choice,
        roundNumber: rpsRoundNumber
      }
    });
  }, [debugMode, pendingPayer, rpsActiveUserIds, rpsRoundEndsAt, rpsRoundNumber]);

  useEffect(() => {
    if (
      !isPaymentOpen ||
      completedOrder ||
      isSignatureOpen ||
      pendingPayer ||
      rpsRoundEndsAt ||
      rpsActiveUserIds.length > 0 ||
      paymentParticipantCount <= 0
    ) {
      return;
    }

    startRpsRound(paymentPlayerList.map((participant) => participant.userId), 1);
  }, [
    completedOrder,
    isPaymentOpen,
    isSignatureOpen,
    paymentParticipantCount,
    paymentPlayerList,
    pendingPayer,
    rpsActiveUserIds.length,
    rpsRoundEndsAt,
    startRpsRound
  ]);

  useEffect(() => {
    if (!rpsRoundEndsAt || pendingPayer || rpsActiveUserIds.length <= 0) {
      return;
    }

    const allSelected = rpsActiveUserIds.every((userId) => Boolean(rpsSelections[userId]));

    if (allSelected || now >= rpsRoundEndsAt) {
      postRpsProgressMessage(
        `rps:${roomName}:${rpsRoundNumber}:${allSelected ? "locked" : "timeout"}`,
        allSelected
          ? `${rpsRoundNumber}라운드 전원 선택 완료. 결과 확인 중입니다.`
          : `${rpsRoundNumber}라운드 시간이 종료되어 미선택 인원은 자동 선택됐습니다.`
      );
      resolveRpsRound(rpsSelections);
    }
  }, [
    now,
    pendingPayer,
    postRpsProgressMessage,
    resolveRpsRound,
    roomName,
    rpsActiveUserIds,
    rpsRoundNumber,
    rpsRoundEndsAt,
    rpsSelections
  ]);

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

  const buyMegaphone = useCallback(() => {
    if (walletBalance < megaphonePrice) {
      return;
    }

    setWalletBalance((current) => Math.max(0, current - megaphonePrice));
    setMegaphoneCount((current) => current + 1);
  }, [walletBalance]);

  const sendMegaphoneMessage = useCallback(async () => {
    const cleanBody = megaphoneInput.trim();

    if (!cleanBody || megaphoneCount <= 0 || isCoolingDown) {
      return;
    }

    setMegaphoneCount((current) => Math.max(0, current - 1));
    setMegaphoneInput("");
    setMegaphoneOpen(false);
    await sendMessage(`[확성기] ${cleanBody}`, "system");
  }, [isCoolingDown, megaphoneCount, megaphoneInput, sendMessage]);

  const getSignaturePoint = useCallback((event: ReactPointerEvent<SVGSVGElement>): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 320,
      y: ((event.clientY - rect.top) / rect.height) * 160
    };
  }, []);

  const startSignatureStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setCurrentSignatureStroke([getSignaturePoint(event)]);
  }, [getSignaturePoint]);

  const moveSignatureStroke = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!currentSignatureStroke) {
      return;
    }

    const nextPoint = getSignaturePoint(event);
    setCurrentSignatureStroke((current) => (current ? [...current, nextPoint] : current));
  }, [currentSignatureStroke, getSignaturePoint]);

  const finishSignatureStroke = useCallback(() => {
    setCurrentSignatureStroke((current) => {
      if (current && current.length > 1) {
        setSignatureStrokes((strokes) => [...strokes, current]);
      }

      return null;
    });
  }, []);

  const approveSignedPayment = useCallback(() => {
    if (!pendingPayer || orderTotal <= 0 || visibleSignatureStrokes.length <= 0) {
      return;
    }

    const isMine = pendingPayer.userId === sessionIdRef.current;
    const walletChargeAmount = isMine ? Math.min(orderTotal, walletBalance) : 0;

    const receipt: ApprovedReceipt = {
      id: createId(),
      payerNickname: pendingPayer.nickname,
      payerRole: pendingPayer.role,
      amount: orderTotal,
      at: Date.now(),
      items: receiptLines,
      signatureStrokes: visibleSignatureStrokes
    };

    setSignatureOpen(false);
    setPaymentOpen(false);
    registerApprovedReceipt(receipt);
    completeResolvedPayment({
      id: receipt.id,
      payerNickname: receipt.payerNickname,
      payerRole: receipt.payerRole,
      amount: receipt.amount,
      at: receipt.at,
      label: "결제 승인",
      method: "rps"
    }, walletChargeAmount);
    void channelRef.current?.send({
      type: "broadcast",
      event: "receipt_approved",
      payload: receipt
    });
    resetPaymentSession();
  }, [
    completeResolvedPayment,
    orderTotal,
    pendingPayer,
    receiptLines,
    registerApprovedReceipt,
    resetPaymentSession,
    visibleSignatureStrokes,
    walletBalance
  ]);

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

  const renderRpsCircle = (round: RpsRound) => {
    const players = round.players;

    return (
      <div className="rps-result-circle" aria-label="가위바위보 결과">
        {players.map((player, index) => {
          const angle = players.length > 1 ? (index / players.length) * 360 : 0;
          const angleRadians = (angle * Math.PI) / 180;
          const radius = 34;
          const x = 50 + Math.sin(angleRadians) * radius;
          const y = 50 - Math.cos(angleRadians) * radius;
          const choice = player.choice
            ? rpsChoices.find((item) => item.id === player.choice) ?? null
            : null;
          const ChoiceIcon = choice?.icon;

          return (
            <div
              key={player.userId}
              className={`rps-result-player ${player.status}`}
              style={{
                "--player-x": `${x}%`,
                "--player-y": `${y}%`
              } as CSSProperties}
            >
              <span className="rps-hand-icon" aria-hidden="true">
                {ChoiceIcon ? <ChoiceIcon size={44} strokeWidth={2.4} /> : "?"}
              </span>
              <span className="rps-result-name">
                <NameWithRole nickname={player.nickname} role={player.role} />
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSignatureSvg = (
    strokes: SignatureStroke[],
    className = "signature-preview",
    draftStroke: SignatureStroke | null = null
  ) => {
    const allStrokes = draftStroke ? [...strokes, draftStroke] : strokes;

    return (
      <svg className={className} viewBox="0 0 320 160" aria-hidden="true">
        {allStrokes.map((stroke, index) => (
          <path
            key={`${index}-${stroke.length}`}
            d={createSignaturePath(stroke)}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
        ))}
      </svg>
    );
  };

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
            onClick={() => setMegaphoneOpen(true)}
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
              <h1>
                {onLeave ? (
                  <button type="button" className="room-home-title-button" onClick={onLeave}>
                    회식
                  </button>
                ) : (
                  "회식"
                )}
              </h1>
            </div>
            <div className="topbar-actions">
              <span className="money-pill topbar-money">내 돈 {formatPrice(walletBalance)}</span>
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
                    <strong className="scene-room-title">{roomTitle || "이름 없는 회식방"}</strong>
                    <span className="stat-separator" aria-hidden="true">
                      |
                    </span>
                    <span>접속 {onlineCount}명</span>
                    <span className="stat-separator" aria-hidden="true">
                      |
                    </span>
                    <span>누적 회식 시간 {formatDuration(roomElapsedMinutes)}</span>
                    <span className="stat-separator" aria-hidden="true">
                      |
                    </span>
                    <span>누적 결제 {formatPrice(totalPaymentAmount)}</span>
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
                  <div className="served-dish-layer" aria-hidden="true">
                    {servedDishes.map((dish, index) => {
                      const slot = servedDishSlotList[dish.slotIndex % servedDishSlotList.length];
                      const enterX = slot.x < 45 ? -96 : slot.x > 55 ? 96 : 0;
                      const enterY = slot.y < 45 ? -80 : slot.y > 55 ? 80 : 96;

                      return (
                        <div
                          key={dish.id}
                          className="served-dish"
                          style={{
                            "--dish-x": `${slot.x}%`,
                            "--dish-y": `${slot.y}%`,
                            "--dish-enter-x": `${enterX}px`,
                            "--dish-enter-y": `${enterY}px`,
                            "--dish-delay": `${Math.min(index, 5) * 70}ms`
                          } as CSSProperties}
                        >
                          <span>{dish.icon}</span>
                          <strong>{dish.name}</strong>
                          {dish.count > 1 ? <small>x{dish.count}</small> : null}
                        </div>
                      );
                    })}
                  </div>

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
                          <small>
                            {member
                              ? formatDuration(Math.floor((now - member.joinedAt) / 60000))
                              : "착석 가능"}
                          </small>
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
                      const isPromotedBubble = promotedBubbleId === visibleSeatMessage.id;

                      return (
                        <div
                          key={`bubble-${member?.id ?? index}`}
                          className={`seat-bubble-anchor slot-${index}`}
                          style={{ zIndex: isPromotedBubble ? bubbleLifetimeMs + 1 : bubbleStackLevel }}
                        >
                          <button
                            type="button"
                            className={`seat-bubble ${visibleSeatMessage.kind ?? "normal"}`}
                            onClick={() => setPromotedBubbleId(visibleSeatMessage.id)}
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
                  className="menu-trigger table-receipt-trigger"
                  onClick={() => setReceiptListOpen(true)}
                  aria-label="영수증 모아보기"
                  title="영수증"
                >
                  <ReceiptText size={30} />
                  <span>영수증</span>
                </button>
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
              <div className="order-choice-panel" ref={orderChoicePanelRef}>
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
                <p id="payment-title">가위바위보로 단 한 명 결제 승부</p>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setPaymentOpen(false)}
                aria-label="결제 닫기"
              >
                ×
              </button>
            </div>

            {!isSignatureOpen ? (
              <>
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
                    {pendingPayer
                      ? "결제 대상 확정"
                      : rpsRemainingSeconds !== null
                        ? `${rpsRemainingSeconds}초`
                        : `${paymentParticipantCount}명 참가 중`}
                  </span>
                </div>
              </>
            ) : null}

            {isSignatureOpen && pendingPayer ? (
              <div className="signature-payment-panel">
                <div className="receipt-paper">
                  <strong>영수증</strong>
                  <span>
                    <NameWithRole nickname={pendingPayer.nickname} role={pendingPayer.role} />
                  </span>
                  <div className="receipt-lines">
                    {receiptLines.map((item) => (
                      <div key={item.name}>
                        <span>{item.name} x {item.count}</span>
                        <strong>{formatPrice(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="receipt-total">
                    <span>합계</span>
                    <strong>{formatPrice(orderTotal)}</strong>
                  </div>
                </div>

                <div className="signature-pad-wrap">
                  <span>사인</span>
                  <svg
                    className="signature-pad"
                    viewBox="0 0 320 160"
                    role="img"
                    aria-label="사인 입력 영역"
                    onPointerDown={startSignatureStroke}
                    onPointerMove={moveSignatureStroke}
                    onPointerUp={finishSignatureStroke}
                    onPointerCancel={finishSignatureStroke}
                    onPointerLeave={finishSignatureStroke}
                  >
                    <rect width="320" height="160" rx="8" />
                    {visibleSignatureStrokes.map((stroke, index) => (
                      <path
                        key={`${index}-${stroke.length}`}
                        d={createSignaturePath(stroke)}
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="5"
                      />
                    ))}
                  </svg>
                </div>

                <div className="signature-actions">
                  <button
                    type="button"
                    className="signature-clear-button"
                    onClick={() => {
                      setSignatureStrokes([]);
                      setCurrentSignatureStroke(null);
                    }}
                  >
                    지우기
                  </button>
                  <button
                    type="button"
                    className="signature-pay-button"
                    disabled={!hasSignatureStroke}
                    onClick={approveSignedPayment}
                  >
                    결제 승인
                  </button>
                </div>
              </div>
            ) : completedOrder ? (
              <div className="order-complete payment-complete-card">
                <div className="payment-complete-badge" aria-hidden="true">
                  완료
                </div>
                <strong>
                  {completedOrder.method === "rps" ? (
                    <NameWithRole
                      nickname={completedOrder.payerNickname}
                      role={completedOrder.payerRole}
                    />
                  ) : completedOrder.summary ? (
                    completedOrder.summary
                  ) : (
                    <>
                      <NameWithRole
                        nickname={completedOrder.payerNickname}
                        role={completedOrder.payerRole}
                      />{" "}
                      {completedOrder.label ?? "계산 완료"}
                    </>
                  )}
                </strong>
                <span>{formatPrice(completedOrder.amount)}</span>
                {completedOrder.detail ? <small>{completedOrder.detail}</small> : null}
                {completedOrder.method === "rps" && rpsRound ? renderRpsCircle(rpsRound) : null}
              </div>
            ) : (
              <div className="payment-resolution">
                {rpsRound ? renderRpsCircle(rpsRound) : null}
                {pendingPayer ? (
                  <button
                    type="button"
                    className="payment-sign-button"
                    onClick={() => {
                      setSignatureOpen(true);
                      setSignatureStrokes([]);
                      setCurrentSignatureStroke(null);
                    }}
                  >
                    결제하기
                  </button>
                ) : null}
                {!pendingPayer && rpsRoundEndsAt ? (
                  <div className="rps-choice-list">
                    {rpsChoices.map((choice) => {
                      const ChoiceIcon = choice.icon;
                      const isActiveUser = rpsActiveUserIds.includes(sessionIdRef.current);
                      const isSelected = selectedRpsChoice === choice.id;

                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className={isSelected ? "rps-choice-button selected" : "rps-choice-button"}
                          aria-label={choice.label}
                          title={choice.label}
                          disabled={!rpsRoundEndsAt || !isActiveUser || Boolean(selectedRpsChoice)}
                          onClick={() => submitRpsChoice(choice.id)}
                        >
                          <ChoiceIcon size={38} strokeWidth={2.3} />
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
      {isReceiptListOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setReceiptListOpen(false)}
        >
          <section
            className="receipt-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-list-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-head">
              <div>
                <p id="receipt-list-title">영수증</p>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setReceiptListOpen(false)}
                aria-label="영수증 닫기"
              >
                ×
              </button>
            </div>
            <div className="receipt-list">
              {approvedReceipts.length > 0 ? (
                approvedReceipts.map((receipt) => (
                  <article key={receipt.id} className="receipt-card">
                    <div>
                      <strong>
                        <NameWithRole nickname={receipt.payerNickname} role={receipt.payerRole} />
                      </strong>
                      <time>{formatClock(receipt.at)}</time>
                    </div>
                    <span>{formatPrice(receipt.amount)}</span>
                    {renderSignatureSvg(receipt.signatureStrokes)}
                  </article>
                ))
              ) : (
                <p className="empty-receipt">아직 승인된 영수증이 없습니다.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {latestReceipt ? (
        <div className="receipt-approval-toast" role="status" aria-live="polite">
          <strong>결제가 승인되었습니다</strong>
          <span>
            <NameWithRole nickname={latestReceipt.payerNickname} role={latestReceipt.payerRole} />
          </span>
          {renderSignatureSvg(latestReceipt.signatureStrokes, "signature-preview toast-signature")}
        </div>
      ) : null}
      {isMegaphoneOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setMegaphoneOpen(false)}
        >
          <section
            className="megaphone-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="megaphone-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="megaphone-head">
              <div>
                <p id="megaphone-title">확성기</p>
                <span>확성기로 모든 회식방에 채팅을 보냅니다</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setMegaphoneOpen(false)}
                aria-label="확성기 닫기"
              >
                ×
              </button>
            </div>

            <div className="megaphone-body">
              <div className="megaphone-status">
                <span>보유 확성기</span>
                <strong>{megaphoneCount}개</strong>
              </div>
              <button
                type="button"
                className="megaphone-buy-button"
                onClick={buyMegaphone}
                disabled={walletBalance < megaphonePrice}
              >
                확성기 구매 {formatPrice(megaphonePrice)}
              </button>
              <form
                className="megaphone-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMegaphoneMessage();
                }}
              >
                <input
                  aria-label="확성기 메시지"
                  maxLength={120}
                  placeholder="모든 회식방에 보낼 메시지"
                  value={megaphoneInput}
                  onChange={(event) => setMegaphoneInput(event.target.value)}
                />
                <div className="megaphone-actions">
                  <button
                    type="button"
                    className="megaphone-cancel-button"
                    onClick={() => setMegaphoneOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="megaphone-send-button"
                    disabled={megaphoneCount <= 0 || isCoolingDown || !megaphoneInput.trim()}
                  >
                    전송
                  </button>
                </div>
              </form>
            </div>
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
              <input
                aria-label="회식방 이름"
                maxLength={28}
                value={roomTitle}
                onChange={(event) => updateRoomTitle(event.target.value)}
              />
            </div>

            <div className="settings-section">
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

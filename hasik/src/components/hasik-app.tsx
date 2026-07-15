"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { HasikRoom } from "@/components/hasik-room";
import type { RoomVenue, TableShape } from "@/components/hasik-room";
import { getSavedWalletState } from "@/lib/wallet";

interface LobbyRoom {
  id: string;
  title: string;
  tableShape: TableShape;
  roomVenue: RoomVenue;
  createdAt: number;
  hostName: string;
  hostSessionId: string;
  memberCount: number;
  totalPaymentAmount: number;
  isPrivate: boolean;
  password: string;
  debugMode?: boolean;
}

const lobbyStorageKey = "hasik:lobby-rooms";
const lobbyUserStorageKey = "hasik:lobby-user-id";
const debugRoomId = "debug-full-seats-room";
const paymentDebugRoomId = "debug-payment-room";
const privateDebugRoomId = "debug-private-room";

const defaultRooms: LobbyRoom[] = [
  {
    id: "main-room",
    title: "퇴근 후 익명 회식방",
    tableShape: "round",
    roomVenue: "a",
    createdAt: Date.now() - 1000 * 60 * 34,
    hostName: "시스템",
    hostSessionId: "system-host",
    memberCount: 3,
    totalPaymentAmount: 0,
    isPrivate: false,
    password: ""
  },
  {
    id: "team-dinner-room",
    title: "프로젝트 뒤풀이",
    tableShape: "rectangle",
    roomVenue: "b",
    createdAt: Date.now() - 1000 * 60 * 12,
    hostName: "익명",
    hostSessionId: "anonymous-host",
    memberCount: 2,
    totalPaymentAmount: 0,
    isPrivate: false,
    password: ""
  }
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
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

function getLobbyUserId() {
  const nextId = `user-${createId()}`;

  if (typeof window === "undefined") {
    return nextId;
  }

  try {
    const savedId = localStorage.getItem(lobbyUserStorageKey);

    if (savedId) {
      return savedId;
    }

    localStorage.setItem(lobbyUserStorageKey, nextId);
  } catch {
    return nextId;
  }

  return nextId;
}

function isTableShape(value: unknown): value is TableShape {
  return value === "round" || value === "rectangle";
}

function isRoomVenue(value: unknown): value is RoomVenue {
  return value === "a" || value === "b" || value === "c";
}

function normalizeMemberCount(value: unknown) {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return 1;
  }

  return Math.max(0, Math.floor(count));
}

function createDebugRoom(fallbackHostSessionId: string): LobbyRoom {
  return {
    id: debugRoomId,
    title: "말풍선 디버그 방",
    tableShape: "round",
    roomVenue: "a",
    createdAt: Date.now() - 1000 * 60,
    hostName: "테스트",
    hostSessionId: fallbackHostSessionId,
    memberCount: 8,
    totalPaymentAmount: 0,
    isPrivate: false,
    password: "",
    debugMode: true
  };
}

function createPaymentDebugRoom(fallbackHostSessionId: string): LobbyRoom {
  return {
    id: paymentDebugRoomId,
    title: "결제 디버그 방",
    tableShape: "rectangle",
    roomVenue: "c",
    createdAt: Date.now() - 1000 * 60 * 7,
    hostName: "테스트",
    hostSessionId: fallbackHostSessionId,
    memberCount: 8,
    totalPaymentAmount: 0,
    isPrivate: false,
    password: "",
    debugMode: true
  };
}

function createPrivateDebugRoom(fallbackHostSessionId: string): LobbyRoom {
  return {
    id: privateDebugRoomId,
    title: "비밀방 테스트 방",
    tableShape: "round",
    roomVenue: "b",
    createdAt: Date.now() - 1000 * 60 * 3,
    hostName: "테스트",
    hostSessionId: fallbackHostSessionId,
    memberCount: 1,
    totalPaymentAmount: 0,
    isPrivate: true,
    password: "1234"
  };
}

function ensureDebugRooms(rooms: LobbyRoom[], fallbackHostSessionId: string) {
  return [
    createPaymentDebugRoom(fallbackHostSessionId),
    createDebugRoom(fallbackHostSessionId),
    createPrivateDebugRoom(fallbackHostSessionId),
    ...rooms.filter(
      (room) =>
        room.id !== debugRoomId &&
        room.id !== paymentDebugRoomId &&
        room.id !== privateDebugRoomId
    )
  ];
}

function normalizeRooms(value: unknown, fallbackHostSessionId: string): LobbyRoom[] {
  if (!Array.isArray(value)) {
    return ensureDebugRooms(defaultRooms, fallbackHostSessionId);
  }

  const normalizedRooms = value
    .flatMap((room): LobbyRoom[] => {
      if (!room || typeof room !== "object") {
        return [];
      }

      const sourceRoom = room as Partial<LobbyRoom>;
      const id = typeof sourceRoom.id === "string" && sourceRoom.id.trim() ? sourceRoom.id : "";
      const title =
        typeof sourceRoom.title === "string" && sourceRoom.title.trim()
          ? sourceRoom.title
          : "이름 없는 회식방";
      const tableShape = isTableShape(sourceRoom.tableShape) ? sourceRoom.tableShape : "round";
      const roomVenue = isRoomVenue(sourceRoom.roomVenue) ? sourceRoom.roomVenue : "a";
      const createdAt =
        typeof sourceRoom.createdAt === "number" && Number.isFinite(sourceRoom.createdAt)
          ? sourceRoom.createdAt
          : Date.now();
      const memberCount = normalizeMemberCount(sourceRoom.memberCount);
      const totalPaymentAmount =
        typeof sourceRoom.totalPaymentAmount === "number" && Number.isFinite(sourceRoom.totalPaymentAmount)
          ? Math.max(0, Math.floor(sourceRoom.totalPaymentAmount))
          : 0;
      const password =
        typeof sourceRoom.password === "string" && sourceRoom.password.trim()
          ? sourceRoom.password
          : "";
      const isPrivate = sourceRoom.isPrivate === true && Boolean(password);

      if (!id || memberCount < 1) {
        return [];
      }

      return [
        {
          id,
          title,
          tableShape,
          roomVenue,
          createdAt,
          hostName:
            typeof sourceRoom.hostName === "string" && sourceRoom.hostName.trim()
              ? sourceRoom.hostName
              : "익명",
          hostSessionId:
            typeof sourceRoom.hostSessionId === "string" && sourceRoom.hostSessionId.trim()
              ? sourceRoom.hostSessionId
              : fallbackHostSessionId,
          memberCount,
          totalPaymentAmount,
          isPrivate,
          password: isPrivate ? password : "",
          debugMode: sourceRoom.debugMode === true
        }
      ];
    });

  return ensureDebugRooms(normalizedRooms, fallbackHostSessionId);
}

export function HasikApp() {
  const [currentUserId] = useState(getLobbyUserId);
  const [rooms, setRooms] = useState<LobbyRoom[]>(() => ensureDebugRooms(defaultRooms, currentUserId));
  const [hasLoadedRooms, setHasLoadedRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newRoomTitle, setNewRoomTitle] = useState("새 회식방");
  const [newRoomTableShape, setNewRoomTableShape] = useState<TableShape>("round");
  const [newRoomVenue, setNewRoomVenue] = useState<RoomVenue>("a");
  const [newRoomIsPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [isCreateRoomOpen, setCreateRoomOpen] = useState(false);
  const [pendingPrivateRoom, setPendingPrivateRoom] = useState<LobbyRoom | null>(null);
  const [privateRoomPassword, setPrivateRoomPassword] = useState("");
  const [privateRoomError, setPrivateRoomError] = useState("");
  const [walletBalance, setWalletBalance] = useState(() => getSavedWalletState().balance);
  const [lobbyNow, setLobbyNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const savedRooms = localStorage.getItem(lobbyStorageKey);

      if (savedRooms) {
        setRooms(normalizeRooms(JSON.parse(savedRooms), currentUserId));
      }
    } catch {
      setRooms(ensureDebugRooms(defaultRooms, currentUserId));
    } finally {
      setHasLoadedRooms(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!hasLoadedRooms) {
      return;
    }

    localStorage.setItem(lobbyStorageKey, JSON.stringify(rooms));
  }, [hasLoadedRooms, rooms]);

  useEffect(() => {
    const syncWalletBalance = () => setWalletBalance(getSavedWalletState().balance);

    syncWalletBalance();
    const timer = window.setInterval(syncWalletBalance, 30000);
    window.addEventListener("focus", syncWalletBalance);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncWalletBalance);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setLobbyNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setWalletBalance(getSavedWalletState().balance);
    }
  }, [selectedRoomId]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );
  const quickJoinRooms = useMemo(
    () => rooms.filter((room) => !room.debugMode && !room.isPrivate && room.memberCount > 0),
    [rooms]
  );
  const canCreateRoom = !newRoomIsPrivate || Boolean(newRoomPassword.trim());

  function enterRoom(room: LobbyRoom) {
    setRooms((current) =>
      current.map((currentRoom) =>
        currentRoom.id === room.id
          ? {
              ...currentRoom,
              memberCount: currentRoom.debugMode ? 8 : currentRoom.memberCount + 1
            }
          : currentRoom
      )
    );
    setSelectedRoomId(room.id);
  }

  function requestEnterRoom(room: LobbyRoom) {
    if (!room.isPrivate) {
      enterRoom(room);
      return;
    }

    setPendingPrivateRoom(room);
    setPrivateRoomPassword("");
    setPrivateRoomError("");
  }

  function closePrivateRoomPrompt() {
    setPendingPrivateRoom(null);
    setPrivateRoomPassword("");
    setPrivateRoomError("");
  }

  function submitPrivateRoomPassword() {
    if (!pendingPrivateRoom) {
      return;
    }

    if (privateRoomPassword.trim() !== pendingPrivateRoom.password) {
      setPrivateRoomError("비밀번호가 맞지 않습니다.");
      return;
    }

    const nextRoom = pendingPrivateRoom;
    closePrivateRoomPrompt();
    enterRoom(nextRoom);
  }

  function quickJoinRoom() {
    if (quickJoinRooms.length === 0) {
      return;
    }

    const room = quickJoinRooms[Math.floor(Math.random() * quickJoinRooms.length)];
    enterRoom(room);
  }

  function createRoom() {
    const title = newRoomTitle.trim() || "이름 없는 회식방";
    const password = newRoomIsPrivate ? newRoomPassword.trim() : "";

    if (newRoomIsPrivate && !password) {
      return;
    }

    const nextRoom: LobbyRoom = {
      id: `room-${createId()}`,
      title,
      tableShape: newRoomTableShape,
      roomVenue: newRoomVenue,
      createdAt: Date.now(),
      hostName: "익명",
      hostSessionId: currentUserId,
      memberCount: 1,
      totalPaymentAmount: 0,
      isPrivate: newRoomIsPrivate,
      password
    };

    setRooms((current) => [nextRoom, ...current]);
    setNewRoomTitle("새 회식방");
    setNewRoomTableShape("round");
    setNewRoomVenue("a");
    setNewRoomPrivate(false);
    setNewRoomPassword("");
    setCreateRoomOpen(false);
    setSelectedRoomId(nextRoom.id);
  }

  function leaveRoom() {
    if (!selectedRoom) {
      setSelectedRoomId(null);
      return;
    }

    setRooms((current) =>
      current.flatMap((room) => {
        if (room.id !== selectedRoom.id) {
          return room.memberCount > 0 ? [room] : [];
        }

        if (room.debugMode) {
          return [{ ...room, memberCount: 8 }];
        }

        const nextMemberCount = room.memberCount - 1;
        return nextMemberCount > 0 ? [{ ...room, memberCount: nextMemberCount }] : [];
      })
    );
    setSelectedRoomId(null);
  }

  function updateRoomTitle(roomId: string, title: string) {
    setRooms((current) =>
      current.map((room) => (room.id === roomId ? { ...room, title: title || room.title } : room))
    );
  }

  function updateRoomTableShape(roomId: string, tableShape: TableShape) {
    setRooms((current) =>
      current.map((room) => (room.id === roomId ? { ...room, tableShape } : room))
    );
  }

  function updateRoomVenue(roomId: string, roomVenue: RoomVenue) {
    setRooms((current) =>
      current.map((room) => (room.id === roomId ? { ...room, roomVenue } : room))
    );
  }

  function addRoomPayment(roomId: string, amount: number) {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? { ...room, totalPaymentAmount: room.totalPaymentAmount + Math.max(0, Math.floor(amount)) }
          : room
      )
    );
  }

  if (selectedRoom) {
    return (
      <HasikRoom
        key={selectedRoom.id}
        initialRoomTitle={selectedRoom.title}
        initialRoomCreatedAt={selectedRoom.createdAt}
        initialTotalPaymentAmount={selectedRoom.totalPaymentAmount}
        initialTableShape={selectedRoom.tableShape}
        initialRoomVenue={selectedRoom.roomVenue}
        canManageRoomSettings={selectedRoom.hostSessionId === currentUserId}
        debugMode={selectedRoom.debugMode}
        roomNameOverride={selectedRoom.id}
        onLeave={leaveRoom}
        onRoomTitleChange={(title) => updateRoomTitle(selectedRoom.id, title)}
        onTableShapeChange={(tableShape) => updateRoomTableShape(selectedRoom.id, tableShape)}
        onRoomVenueChange={(roomVenue) => updateRoomVenue(selectedRoom.id, roomVenue)}
        onOrderCompleted={(amount) => addRoomPayment(selectedRoom.id, amount)}
      />
    );
  }

  return (
    <main className="lobby-page">
      <section className="lobby-shell" aria-label="회식 메인 메뉴">
        <header className="lobby-header">
          <div>
            <h1>회식</h1>
            <p>만들어진 회식방을 고르거나 새 방을 만드세요.</p>
          </div>
          <div className="lobby-actions">
            <span className="money-pill lobby-money">Ⓒ {formatPrice(walletBalance)}</span>
            <a className="lobby-guide-link" href="../articles/dinner-room-rules.html">
              이용안내
            </a>
          </div>
        </header>

        <div className="lobby-primary-actions" aria-label="회식 참가 메뉴">
          <button
            type="button"
            className="quick-join-button"
            onClick={quickJoinRoom}
            disabled={quickJoinRooms.length === 0}
          >
            빠른 참가
          </button>
          <button
            type="button"
            className="create-room-open-button"
            onClick={() => setCreateRoomOpen(true)}
          >
            회식 만들기
          </button>
        </div>

        <div className="lobby-grid">
          <section className="lobby-panel room-list-panel" aria-label="회식방 목록">
            <div className="room-list">
              {rooms.length > 0 ? rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="room-list-item"
                  onClick={() => requestEnterRoom(room)}
                >
                  <span>
                    <strong className="room-list-title">
                      {room.isPrivate ? <LockKeyhole className="room-lock-icon" size={15} aria-hidden="true" /> : null}
                      <span>{room.title}</span>
                    </strong>
                    <small className="room-list-meta">
                      <span>{room.memberCount}명</span>
                      <span>유지 {formatDuration(Math.floor((lobbyNow - room.createdAt) / 60000))}</span>
                      <span>누적 결제 {formatPrice(room.totalPaymentAmount)}</span>
                    </small>
                  </span>
                  <em>참가</em>
                </button>
              )) : (
                <p className="room-list-empty">열린 회식방이 없습니다.</p>
              )}
            </div>
          </section>

        </div>
      </section>

      {isCreateRoomOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setCreateRoomOpen(false)}
        >
          <section
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lobby-modal-head">
              <div>
                <p id="create-room-title">회식 만들기</p>
                <span>방 이름과 테이블 모양을 정하세요.</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setCreateRoomOpen(false)}
                aria-label="회식 만들기 닫기"
              >
                ×
              </button>
            </div>
            <div className="lobby-modal-body">
              <label className="lobby-label" htmlFor="room-title">
                방 이름
              </label>
              <input
                id="room-title"
                maxLength={28}
                value={newRoomTitle}
                onChange={(event) => setNewRoomTitle(event.target.value)}
              />
              <div className="create-room-options">
                <button
                  type="button"
                  className={newRoomTableShape === "round" ? "selected" : ""}
                  onClick={() => setNewRoomTableShape("round")}
                >
                  원탁
                </button>
                <button
                  type="button"
                  className={newRoomTableShape === "rectangle" ? "selected" : ""}
                  onClick={() => setNewRoomTableShape("rectangle")}
                >
                  직사각형
                </button>
              </div>
              <div className="create-room-options venue-create-options">
                <button
                  type="button"
                  className={newRoomVenue === "a" ? "selected" : ""}
                  onClick={() => setNewRoomVenue("a")}
                >
                  장소 A
                </button>
                <button
                  type="button"
                  className={newRoomVenue === "b" ? "selected" : ""}
                  onClick={() => setNewRoomVenue("b")}
                >
                  장소 B
                </button>
                <button
                  type="button"
                  className={newRoomVenue === "c" ? "selected" : ""}
                  onClick={() => setNewRoomVenue("c")}
                >
                  장소 C
                </button>
              </div>
              <label className="lobby-checkbox">
                <input
                  type="checkbox"
                  checked={newRoomIsPrivate}
                  onChange={(event) => {
                    setNewRoomPrivate(event.target.checked);

                    if (!event.target.checked) {
                      setNewRoomPassword("");
                    }
                  }}
                />
                <span>비밀방</span>
              </label>
              <input
                type="password"
                aria-label="비밀방 비밀번호"
                placeholder="비밀번호"
                value={newRoomPassword}
                disabled={!newRoomIsPrivate}
                onChange={(event) => setNewRoomPassword(event.target.value)}
              />
              <button type="button" className="create-room-button" onClick={createRoom} disabled={!canCreateRoom}>
                방 만들기
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingPrivateRoom ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={closePrivateRoomPrompt}
        >
          <section
            className="lobby-modal private-room-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="private-room-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lobby-modal-head">
              <div>
                <p id="private-room-title">비밀방 입장</p>
                <span>{pendingPrivateRoom.title}</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={closePrivateRoomPrompt}
                aria-label="비밀방 입장 닫기"
              >
                ×
              </button>
            </div>
            <form
              className="lobby-modal-body"
              onSubmit={(event) => {
                event.preventDefault();
                submitPrivateRoomPassword();
              }}
            >
              <input
                type="password"
                aria-label="비밀방 입장 비밀번호"
                placeholder="비밀번호"
                value={privateRoomPassword}
                onChange={(event) => {
                  setPrivateRoomPassword(event.target.value);
                  setPrivateRoomError("");
                }}
              />
              {privateRoomError ? <p className="private-room-error">{privateRoomError}</p> : null}
              <button type="submit" className="create-room-button">
                입장
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

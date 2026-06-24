"use client";

import { useEffect, useMemo, useState } from "react";
import { HasikRoom } from "@/components/hasik-room";
import type { RoomAccessMode, TableShape } from "@/components/hasik-room";

interface LobbyRoom {
  id: string;
  title: string;
  accessMode: RoomAccessMode;
  tableShape: TableShape;
  createdAt: number;
  hostName: string;
}

type SessionMode = "guest" | "member";

const lobbyStorageKey = "hasik:lobby-rooms";
const sessionStorageKey = "hasik:lobby-session";

const defaultRooms: LobbyRoom[] = [
  {
    id: "main-room",
    title: "퇴근 후 익명 회식방",
    accessMode: "anonymous",
    tableShape: "round",
    createdAt: Date.now() - 1000 * 60 * 34,
    hostName: "시스템"
  },
  {
    id: "team-dinner-room",
    title: "프로젝트 뒤풀이",
    accessMode: "nickname",
    tableShape: "rectangle",
    createdAt: Date.now() - 1000 * 60 * 12,
    hostName: "김대리"
  }
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createGuestName() {
  return `익명${Math.floor(100 + Math.random() * 900)}`;
}

export function HasikApp() {
  const [rooms, setRooms] = useState<LobbyRoom[]>(defaultRooms);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("guest");
  const [loginName, setLoginName] = useState("김대리");
  const [newRoomTitle, setNewRoomTitle] = useState("새 회식방");
  const [newRoomAccess, setNewRoomAccess] = useState<RoomAccessMode>("anonymous");
  const [newRoomTableShape, setNewRoomTableShape] = useState<TableShape>("round");
  const [joinNotice, setJoinNotice] = useState("");
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isCreateRoomOpen, setCreateRoomOpen] = useState(false);

  useEffect(() => {
    try {
      const savedRooms = localStorage.getItem(lobbyStorageKey);
      const savedSession = localStorage.getItem(sessionStorageKey);

      if (savedRooms) {
        const parsedRooms = JSON.parse(savedRooms) as LobbyRoom[];
        setRooms(parsedRooms.length > 0 ? parsedRooms : defaultRooms);
      }

      if (savedSession) {
        const parsedSession = JSON.parse(savedSession) as { mode?: SessionMode; loginName?: string };
        setSessionMode(parsedSession.mode === "member" ? "member" : "guest");
        setLoginName(parsedSession.loginName || "김대리");
      }
    } catch {
      setRooms(defaultRooms);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(lobbyStorageKey, JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem(sessionStorageKey, JSON.stringify({ mode: sessionMode, loginName }));
  }, [loginName, sessionMode]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const participantName = useMemo(() => {
    if (!selectedRoom) {
      return "";
    }

    return selectedRoom.accessMode === "anonymous" ? createGuestName() : loginName.trim();
  }, [loginName, selectedRoom]);

  const profileLabel = sessionMode === "guest" ? "게스트" : loginName.trim() || "로그인";
  const profileInitial = sessionMode === "guest" ? "게" : (loginName.trim()[0] ?? "회");

  function enterRoom(room: LobbyRoom) {
    setJoinNotice("");

    if (room.accessMode === "anonymous" && sessionMode !== "guest") {
      setJoinNotice("익명 방은 게스트 모드에서만 입장할 수 있습니다.");
      return;
    }

    if (room.accessMode === "nickname" && (sessionMode !== "member" || !loginName.trim())) {
      setJoinNotice("닉네임 방은 로그인 후 입장할 수 있습니다.");
      return;
    }

    setSelectedRoomId(room.id);
  }

  function createRoom() {
    const title = newRoomTitle.trim() || "이름 없는 회식방";

    if (newRoomAccess === "nickname" && (sessionMode !== "member" || !loginName.trim())) {
      setJoinNotice("닉네임 방을 만들려면 먼저 로그인해주세요.");
      setCreateRoomOpen(false);
      setProfileOpen(true);
      return;
    }

    const nextRoom: LobbyRoom = {
      id: `room-${createId()}`,
      title,
      accessMode: newRoomAccess,
      tableShape: newRoomTableShape,
      createdAt: Date.now(),
      hostName: sessionMode === "member" ? loginName.trim() : "게스트"
    };

    setRooms((current) => [nextRoom, ...current]);
    setNewRoomTitle("새 회식방");
    setJoinNotice("");
    setCreateRoomOpen(false);
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

  if (selectedRoom) {
    return (
      <HasikRoom
        key={selectedRoom.id}
        accessMode={selectedRoom.accessMode}
        initialNickname={participantName}
        initialRoomTitle={selectedRoom.title}
        initialTableShape={selectedRoom.tableShape}
        roomNameOverride={selectedRoom.id}
        onLeave={() => setSelectedRoomId(null)}
        onRoomTitleChange={(title) => updateRoomTitle(selectedRoom.id, title)}
        onTableShapeChange={(tableShape) => updateRoomTableShape(selectedRoom.id, tableShape)}
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
            <button
              type="button"
              className="create-room-open-button"
              onClick={() => setCreateRoomOpen(true)}
            >
              새 회식방
            </button>
            <button
              type="button"
              className="lobby-profile-button"
              onClick={() => setProfileOpen(true)}
              aria-label="내 프로필 열기"
            >
              <span className="lobby-avatar" aria-hidden="true">
                {profileInitial}
              </span>
              <span>{profileLabel}</span>
            </button>
          </div>
        </header>

        <div className="lobby-grid">
          <section className="lobby-panel room-list-panel" aria-label="회식방 목록">
            <div className="lobby-panel-head">
              <strong>회식방 목록</strong>
              <span>{rooms.length}</span>
            </div>
            {joinNotice ? <p className="join-notice">{joinNotice}</p> : null}
            <div className="room-list">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="room-list-item"
                  onClick={() => enterRoom(room)}
                >
                  <span>
                    <strong>{room.title}</strong>
                    <small>
                      {room.accessMode === "anonymous" ? "익명 전용" : "닉네임 전용"} |{" "}
                      {room.tableShape === "round" ? "원탁" : "직사각형"} | 방장 {room.hostName}
                    </small>
                  </span>
                  <em>참가</em>
                </button>
              ))}
            </div>
          </section>

          <section className="lobby-panel lobby-doc-panel" aria-label="회식 관련 사내문서">
            <div className="lobby-panel-head">
              <strong>회식 전 확인 문서</strong>
              <a href="../articles/">전체</a>
            </div>
            <div className="lobby-doc-list">
              <a href="../articles/dinner-room-rules.html">
                <strong>회식방 이용 규칙</strong>
                <small>익명회식방과 닉네임 방을 편하게 쓰는 기준입니다.</small>
              </a>
              <a href="../articles/anonymous-chat-etiquette.html">
                <strong>익명 대화 예절</strong>
                <small>처음 보는 사람과도 안전하게 대화하는 방법입니다.</small>
              </a>
              <a href="../articles/report-block-policy.html">
                <strong>신고/차단 정책 안내</strong>
                <small>불편한 상황을 발견했을 때의 처리 기준입니다.</small>
              </a>
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
                <p id="create-room-title">새 회식방</p>
                <span>방 이름과 입장 방식을 정하세요.</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setCreateRoomOpen(false)}
                aria-label="새 회식방 닫기"
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
                  className={newRoomAccess === "anonymous" ? "selected" : ""}
                  onClick={() => setNewRoomAccess("anonymous")}
                >
                  익명 방
                </button>
                <button
                  type="button"
                  className={newRoomAccess === "nickname" ? "selected" : ""}
                  onClick={() => setNewRoomAccess("nickname")}
                >
                  닉네임 방
                </button>
              </div>
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
              <button type="button" className="create-room-button" onClick={createRoom}>
                방 만들기
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isProfileOpen ? (
        <div
          className="profile-backdrop centered-backdrop"
          role="presentation"
          onClick={() => setProfileOpen(false)}
        >
          <section
            className="lobby-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lobby-modal-head">
              <div>
                <p id="my-profile-title">내 프로필</p>
                <span>{sessionMode === "guest" ? "게스트로 이용 중" : "닉네임으로 이용 중"}</span>
              </div>
              <button
                type="button"
                className="profile-close"
                onClick={() => setProfileOpen(false)}
                aria-label="프로필 닫기"
              >
                ×
              </button>
            </div>
            <div className="lobby-modal-body">
              <div className="profile-summary">
                <span className="lobby-avatar large" aria-hidden="true">
                  {profileInitial}
                </span>
                <strong>{profileLabel}</strong>
              </div>
              <div className="session-switch">
                <button
                  type="button"
                  className={sessionMode === "guest" ? "selected" : ""}
                  onClick={() => setSessionMode("guest")}
                >
                  게스트
                </button>
                <button
                  type="button"
                  className={sessionMode === "member" ? "selected" : ""}
                  onClick={() => setSessionMode("member")}
                >
                  로그인
                </button>
              </div>
              <label className="lobby-label" htmlFor="login-name">
                닉네임
              </label>
              <input
                id="login-name"
                disabled={sessionMode === "guest"}
                maxLength={12}
                value={sessionMode === "guest" ? "익명 자동 배정" : loginName}
                onChange={(event) => setLoginName(event.target.value)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

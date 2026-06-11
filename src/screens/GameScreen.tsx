import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  APP_COLORS,
  BLOCK_COLORS,
  BOARD_COLUMNS,
  FALL_STEP_INTERVAL_MS,
  MAX_SELECTION_LENGTH,
  MIN_SELECTION_LENGTH,
  PENALTY_WRONG_COUNT,
} from "../constants/game";
import {
  Board,
  FallingBlock,
  GamePhase,
  LeaderboardEntry,
  Position,
} from "../types/game";
import {
  applyPenaltyBlocks,
  areAdjacent,
  areSamePosition,
  canMoveFallingBlock,
  collapseBoard,
  createInitialBoard,
  generateTargetNumber,
  getBlockAt,
  getDropIntervalMs,
  getSelectionScore,
  getSelectionSum,
  isGameOver,
  isSelectionChainValid,
  placeFallingBlock,
  refillBoardAfterClear,
  removeSelectedBlocks,
  spawnFallingBlock,
} from "../utils/game";
import { getLeaderboard, saveLeaderboardEntry } from "../utils/storage";

const BOARD_SIDE_PADDING = 24;
const BOARD_GAP = 6;
const BOARD_INNER_PADDING = 10;

function BlockFace({
  block,
  size,
  selectionIndex,
}: {
  block: { value: number };
  size: number;
  selectionIndex: number;
}) {
  return (
    <View
      style={[
        styles.blockToken,
        {
          borderRadius: Math.max(14, Math.floor(size * 0.34)),
          backgroundColor: BLOCK_COLORS[block.value],
        },
      ]}
    >
      <View style={styles.blockSheen} />
      <Text style={[styles.blockValue, size < 28 && styles.blockValueSmall]}>
        {block.value}
      </Text>
      {selectionIndex > 0 ? (
        <Text style={styles.blockIndex}>{selectionIndex}</Text>
      ) : null}
    </View>
  );
}

export function GameScreen() {
  const initialBoardRef = useRef<Board | null>(null);
  if (!initialBoardRef.current) {
    initialBoardRef.current = createInitialBoard();
  }

  const [board, setBoard] = useState<Board>(initialBoardRef.current!);
  const [fallingBlock, setFallingBlock] = useState<FallingBlock | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<Position[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [targetNumber, setTargetNumber] = useState(() =>
    generateTargetNumber(initialBoardRef.current!),
  );
  const [dropIntervalMs, setDropIntervalMs] = useState(() =>
    getDropIntervalMs(0),
  );
  const [gamePhase, setGamePhase] = useState<GamePhase>("playing");
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [pausedForLeaderboard, setPausedForLeaderboard] = useState(false);
  const [statusText, setStatusText] = useState(
    "Blok sec ve hedef sayiya ulasti!",
  );
  const [statusTone, setStatusTone] = useState<
    "neutral" | "danger" | "success"
  >("neutral");

  const boardRef = useRef(board);
  const fallingBlockRef = useRef(fallingBlock);
  const gamePhaseRef = useRef(gamePhase);
  const scoreRef = useRef(score);
  const activeFallingBlockIdRef = useRef<string | null>(null);

  const fallingTranslateY = useRef(new Animated.Value(0)).current;
  const fallingOpacity = useRef(new Animated.Value(0)).current;
  const fallingScale = useRef(new Animated.Value(0.88)).current;

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    boardRef.current = board;
  }, [board]);
  useEffect(() => {
    fallingBlockRef.current = fallingBlock;
  }, [fallingBlock]);
  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Puanın hangi eşiği geçtiğini takip ederek spawn hızını güncelle
  useEffect(() => {
    const next = getDropIntervalMs(score);
    setDropIntervalMs((prev) => (prev !== next ? next : prev));
  }, [score]);

  // Spawn timer — dropIntervalMs veya gamePhase değiştiğinde yeniden oluşur
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const timer = setInterval(() => {
      if (gamePhaseRef.current !== "playing") return;
      if (fallingBlockRef.current) return;
      const next = spawnFallingBlock(boardRef.current);
      if (!next) return;
      setFallingBlock(next);
      setStatusText("Yeni blok dusuyor.");
      setStatusTone("neutral");
    }, dropIntervalMs);
    return () => clearInterval(timer);
  }, [dropIntervalMs, gamePhase]);

  // Düşme adım timer — bloku satır satır aşağı taşır
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const timer = setInterval(() => {
      if (gamePhaseRef.current !== "playing") return;
      const current = fallingBlockRef.current;
      if (!current) return;

      if (canMoveFallingBlock(boardRef.current, current)) {
        setFallingBlock({ ...current, row: current.row + 1 });
        return;
      }

      const placed = placeFallingBlock(boardRef.current, current);
      setFallingBlock(null);

      if (isGameOver(placed)) {
        setBoard(placed);
        setGamePhase("gameover");
        getLeaderboard().then((entries) => setLeaderboard(entries));
        setStatusText("Oyun bitti!");
        setStatusTone("danger");
        return;
      }

      setBoard(placed);
      setTargetNumber((prev) => prev || generateTargetNumber(placed));
      setStatusText("Blok yerine yerlesti.");
      setStatusTone("neutral");
    }, FALL_STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [gamePhase]);

  // Layout hesapları
  const outerBoardWidth = width - BOARD_SIDE_PADDING * 2;
  const isNarrowLayout = width < 390;
  const isCompactLayout = width < 420;
  const widthBasedCellSize = Math.floor(
    (outerBoardWidth - 20 - BOARD_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS,
  );
  const estimatedTopArea = isNarrowLayout ? 296 : isCompactLayout ? 260 : 240;
  const heightBasedCellSize = Math.floor(
    (height -
      insets.top -
      insets.bottom -
      estimatedTopArea -
      BOARD_GAP * 9 -
      20) /
      10,
  );
  const cellSize = Math.max(
    24,
    Math.min(widthBasedCellSize, heightBasedCellSize),
  );
  const cellStep = cellSize + BOARD_GAP;
  const boardWidth =
    cellSize * BOARD_COLUMNS +
    BOARD_GAP * (BOARD_COLUMNS - 1) +
    BOARD_INNER_PADDING * 2;

  // Düşme animasyonu
  useEffect(() => {
    if (!fallingBlock) {
      activeFallingBlockIdRef.current = null;
      fallingOpacity.setValue(0);
      fallingScale.setValue(0.88);
      fallingTranslateY.setValue(0);
      return;
    }

    const nextY = fallingBlock.row * cellStep;

    if (activeFallingBlockIdRef.current !== fallingBlock.block.id) {
      activeFallingBlockIdRef.current = fallingBlock.block.id;
      fallingTranslateY.setValue(nextY);
      fallingOpacity.setValue(0);
      fallingScale.setValue(0.88);

      Animated.parallel([
        Animated.timing(fallingOpacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(fallingScale, {
          toValue: 1,
          friction: 9,
          tension: 90,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(fallingTranslateY, {
        toValue: nextY,
        duration: Math.max(110, FALL_STEP_INTERVAL_MS),
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fallingScale, {
        toValue: 1,
        duration: Math.max(110, FALL_STEP_INTERVAL_MS),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fallingBlock, cellStep, fallingOpacity, fallingScale, fallingTranslateY]);

  // Türetilmiş değerler
  const selectedSum = getSelectionSum(board, selectedPositions);
  const selectionValid = isSelectionChainValid(selectedPositions);
  const confirmEnabled =
    gamePhase === "playing" &&
    !fallingBlock &&
    selectedPositions.length >= MIN_SELECTION_LENGTH &&
    selectionValid;
  const selectedValues = selectedPositions
    .map((pos) => getBlockAt(board, pos)?.value)
    .filter((v): v is number => v !== undefined);
  const speedLevel = Math.round((5000 - dropIntervalMs) / 1000) + 1;
  const selectionHintText =
    selectedPositions.length === 0
      ? "Bekliyor"
      : selectedSum === targetNumber && selectionValid
        ? "Hazir!"
        : "Secim var";

  // --- Handlers ---

  function handleCellPress(position: Position) {
    if (gamePhase !== "playing") return;
    if (fallingBlockRef.current) return;

    const block = getBlockAt(board, position);
    if (!block) return;

    setSelectedPositions((current) => {
      if (current.some((item) => areSamePosition(item, position))) {
        setStatusText("Ayni blok iki kez secilemez.");
        setStatusTone("danger");
        return current;
      }
      if (current.length >= MAX_SELECTION_LENGTH) {
        setStatusText("En fazla 4 blok secebilirsin.");
        setStatusTone("danger");
        return current;
      }
      if (current.length === 0) {
        setStatusText("Ilk blok secildi.");
        setStatusTone("neutral");
        return [position];
      }
      const last = current[current.length - 1]!;
      if (!areAdjacent(last, position)) {
        setStatusText("Blok, zincirdeki son bloga komsu olmali.");
        setStatusTone("danger");
        return current;
      }
      setStatusText("Zincire blok eklendi.");
      setStatusTone("neutral");
      return [...current, position];
    });
  }

  function handleConfirmSelection() {
    if (gamePhase !== "playing") return;
    if (fallingBlockRef.current) return;
    if (!selectionValid) {
      setStatusText(
        `${MIN_SELECTION_LENGTH}-${MAX_SELECTION_LENGTH} arasi komsu blok sec.`,
      );
      setStatusTone("danger");
      return;
    }

    if (selectedSum !== targetNumber) {
      const newWrong = wrongAttempts + 1;
      setSelectedPositions([]);

      if (newWrong >= PENALTY_WRONG_COUNT) {
        const penaltyBoard = applyPenaltyBlocks(board);
        setWrongAttempts(0);

        if (isGameOver(penaltyBoard)) {
          setBoard(penaltyBoard);
          setGamePhase("gameover");
          getLeaderboard().then((entries) => setLeaderboard(entries));
          setStatusText("3 yanlis! Ceza uygulandı — Oyun bitti.");
          setStatusTone("danger");
          return;
        }

        setBoard(penaltyBoard);
        setTargetNumber(generateTargetNumber(penaltyBoard));
        setStatusText("3 yanlis! CEZA: tum sutunlara blok eklendi.");
        setStatusTone("danger");
      } else {
        setWrongAttempts(newWrong);
        setStatusText(
          `Yanlis! Hedef: ${targetNumber}, Toplam: ${selectedSum}. (${newWrong}/${PENALTY_WRONG_COUNT})`,
        );
        setStatusTone("danger");
      }
      return;
    }

    // Dogru hamle
    const cleared = removeSelectedBlocks(board, selectedPositions);
    const collapsed = collapseBoard(cleared);
    const refilled = refillBoardAfterClear(collapsed, selectedPositions.length);
    const gained = getSelectionScore(board, selectedPositions);

    setBoard(refilled);
    setScore((prev) => prev + gained);
    setTargetNumber(generateTargetNumber(refilled));
    setSelectedPositions([]);
    setStatusText(`Dogru! +${gained} puan kazanildi.`);
    setStatusTone("success");
  }

  function resetSelection() {
    setSelectedPositions([]);
    setStatusText("Secim sifirlandi.");
    setStatusTone("neutral");
  }

  async function handleSaveScore() {
    const name = playerName.trim();
    if (!name) return;
    const entry: LeaderboardEntry = {
      id: Date.now().toString(),
      playerName: name,
      score: scoreRef.current,
      date: new Date().toLocaleDateString("tr-TR"),
    };
    const updated = await saveLeaderboardEntry(entry);
    setLeaderboard(updated);
    setScoreSaved(true);
    setGamePhase("leaderboard");
  }

  function handleViewLeaderboard() {
    setPausedForLeaderboard(false);
    getLeaderboard().then((entries) => {
      setLeaderboard(entries);
      setGamePhase("leaderboard");
    });
  }

  function handleOpenLeaderboardDuringPlay() {
    if (gamePhase !== "playing") return;
    setPausedForLeaderboard(true);
    getLeaderboard().then((entries) => {
      setLeaderboard(entries);
      setGamePhase("leaderboard");
    });
  }

  function handleResumeFromLeaderboard() {
    setPausedForLeaderboard(false);
    setGamePhase("playing");
  }

  function handleRestartGame() {
    const newBoard = createInitialBoard();
    setBoard(newBoard);
    setFallingBlock(null);
    setSelectedPositions([]);
    setWrongAttempts(0);
    setScore(0);
    setTargetNumber(generateTargetNumber(newBoard));
    setPlayerName("");
    setScoreSaved(false);
    setPausedForLeaderboard(false);
    setStatusText("Yeni oyun basladi. Iyi sanslar!");
    setStatusTone("neutral");
    setGamePhase("playing");
    activeFallingBlockIdRef.current = null;
    fallingTranslateY.setValue(0);
    fallingOpacity.setValue(0);
    fallingScale.setValue(0.88);
  }

  // --- Render ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {/* Üst panel */}
        <View style={styles.topPanel}>
          {/* Başlık + Skor */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              Stratejik Sayi Birlestirme
            </Text>
            <Pressable
              onPress={handleOpenLeaderboardDuringPlay}
              style={styles.headerIconButton}
            >
              <Text style={styles.headerIconText}>🏆</Text>
            </Pressable>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreBadgeLabel}>PUAN</Text>
              <Text style={styles.scoreBadgeValue}>{score}</Text>
            </View>
          </View>

          {/* Hedef / Hız / Yanlış */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { flex: 1.3 }]}>
              <Text style={styles.statCardLabel}>HEDEF</Text>
              <Text style={styles.statCardBig}>{targetNumber}</Text>
              <Text style={styles.statCardSub}>{selectionHintText}</Text>
            </View>

            <View style={[styles.statCard, { flex: 0.9 }]}>
              <Text style={styles.statCardLabel}>HIZ</Text>
              <Text style={styles.statCardBig}>{speedLevel}</Text>
              <Text style={styles.statCardSub}>{dropIntervalMs / 1000}s</Text>
            </View>

            <View style={[styles.statCard, { flex: 1 }]}>
              <Text style={styles.statCardLabel}>YANLIS</Text>
              <View style={styles.wrongDots}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.wrongDot,
                      i < wrongAttempts && styles.wrongDotFilled,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.statCardSub}>
                {wrongAttempts}/{PENALTY_WRONG_COUNT}
              </Text>
            </View>
          </View>

          {/* Seçim bölümü */}
          <View style={styles.selectionSection}>
            <View style={styles.selectionChipRow}>
              <View style={styles.selectionChip}>
                <Text style={styles.selectionChipLabel}>Secilen</Text>
                <Text style={styles.selectionChipValue}>
                  {selectedPositions.length}/4
                </Text>
              </View>
              <View
                style={[
                  styles.selectionChip,
                  selectedSum === targetNumber &&
                    selectionValid &&
                    styles.selectionChipSuccess,
                ]}
              >
                <Text style={styles.selectionChipLabel}>Toplam</Text>
                <Text style={styles.selectionChipValue}>{selectedSum}</Text>
              </View>
            </View>

            <View style={styles.selectedValuesRow}>
              {selectedValues.length > 0 ? (
                selectedValues.map((v, i) => (
                  <View
                    key={`pill-${i}`}
                    style={[
                      styles.selectedValuePill,
                      { backgroundColor: BLOCK_COLORS[v] },
                    ]}
                  >
                    <Text style={styles.selectedValueOrder}>{i + 1}</Text>
                    <Text style={styles.selectedValueText}>{v}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.selectedValuesSpacer} />
              )}
            </View>
          </View>

          {/* Durum çubuğu */}
          <View
            style={[
              styles.statusPanel,
              statusTone === "danger" && styles.statusPanelDanger,
              statusTone === "success" && styles.statusPanelSuccess,
            ]}
          >
            <Text style={styles.statusText} numberOfLines={1}>
              {statusText}
            </Text>
          </View>

          {/* Kontroller */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={handleConfirmSelection}
              disabled={!confirmEnabled}
              style={[
                styles.primaryButton,
                !confirmEnabled && styles.buttonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  !confirmEnabled && styles.primaryButtonTextDisabled,
                ]}
              >
                Hamleyi Onayla
              </Text>
            </Pressable>
            <Pressable onPress={resetSelection} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Secimi Temizle</Text>
            </Pressable>
          </View>
        </View>

        {/* Oyun tahtası */}
        <View style={styles.boardShell}>
          <View style={[styles.board, { width: boardWidth }]}>
            {board.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.boardRow}>
                {row.map((block, colIndex) => {
                  const position = { row: rowIndex, col: colIndex };
                  const isSelected = selectedPositions.some((item) =>
                    areSamePosition(item, position),
                  );
                  const selectionIndex = isSelected
                    ? selectedPositions.findIndex((item) =>
                        areSamePosition(item, position),
                      ) + 1
                    : 0;

                  return (
                    <Pressable
                      key={`cell-${rowIndex}-${colIndex}`}
                      onPress={() => handleCellPress(position)}
                      style={[
                        styles.cell,
                        {
                          width: cellSize,
                          height: cellSize,
                          marginRight:
                            colIndex === BOARD_COLUMNS - 1 ? 0 : BOARD_GAP,
                        },
                        isSelected && styles.cellSelected,
                      ]}
                    >
                      {block ? (
                        <BlockFace
                          block={block}
                          size={cellSize}
                          selectionIndex={selectionIndex}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {fallingBlock ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.fallingOverlay,
                  {
                    width: cellSize,
                    height: cellSize,
                    left: BOARD_INNER_PADDING + fallingBlock.col * cellStep,
                    top: BOARD_INNER_PADDING,
                    opacity: fallingOpacity,
                    transform: [
                      { translateY: fallingTranslateY },
                      { scale: fallingScale },
                    ],
                  },
                ]}
              >
                <BlockFace
                  block={fallingBlock.block}
                  size={cellSize}
                  selectionIndex={0}
                />
              </Animated.View>
            ) : null}
          </View>
        </View>

        {/* ── Oyun Bitti Overlay ── */}
        {gamePhase === "gameover" && (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayTitle}>OYUN BITTI</Text>
              <Text style={styles.overlayScore}>{score}</Text>
              <Text style={styles.overlayScoreLabel}>PUAN</Text>

              {!scoreSaved && (
                <>
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Adinizi girin..."
                    placeholderTextColor={APP_COLORS.textMuted}
                    value={playerName}
                    onChangeText={setPlayerName}
                    maxLength={20}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveScore}
                  />
                  <Pressable
                    onPress={handleSaveScore}
                    disabled={!playerName.trim()}
                    style={[
                      styles.overlayButton,
                      !playerName.trim() && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.overlayButtonText}>Skoru Kaydet</Text>
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={handleViewLeaderboard}
                style={styles.overlayButtonSecondary}
              >
                <Text style={styles.overlayButtonSecondaryText}>
                  Liderlik Tablosu
                </Text>
              </Pressable>

              <Pressable
                onPress={handleRestartGame}
                style={styles.overlayButtonSecondary}
              >
                <Text style={styles.overlayButtonSecondaryText}>
                  Yeniden Basla
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Liderlik Tablosu Overlay ── */}
        {gamePhase === "leaderboard" && (
          <View style={styles.overlay}>
            <View style={styles.leaderboardCard}>
              <Text style={styles.overlayTitle}>LIDERLIK TABLOSU</Text>

              {leaderboard.length === 0 ? (
                <Text style={styles.emptyText}>Henuz kayitli skor yok.</Text>
              ) : (
                <ScrollView
                  style={styles.leaderboardScroll}
                  showsVerticalScrollIndicator={false}
                >
                  {leaderboard.map((entry, index) => (
                    <View
                      key={entry.id}
                      style={[
                        styles.leaderboardRow,
                        index === 0 && styles.leaderboardRowFirst,
                      ]}
                    >
                      <Text
                        style={[
                          styles.leaderboardRank,
                          index === 0 && styles.leaderboardRankFirst,
                        ]}
                      >
                        #{index + 1}
                      </Text>
                      <View style={styles.leaderboardInfo}>
                        <Text style={styles.leaderboardName} numberOfLines={1}>
                          {entry.playerName}
                        </Text>
                        <Text style={styles.leaderboardDate}>{entry.date}</Text>
                      </View>
                      <Text
                        style={[
                          styles.leaderboardScore,
                          index === 0 && styles.leaderboardScoreFirst,
                        ]}
                      >
                        {entry.score}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {pausedForLeaderboard && (
                <Pressable
                  onPress={handleResumeFromLeaderboard}
                  style={styles.overlayButton}
                >
                  <Text style={styles.overlayButtonText}>Devam Et</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleRestartGame}
                style={
                  pausedForLeaderboard
                    ? styles.overlayButtonSecondary
                    : styles.overlayButton
                }
              >
                <Text
                  style={
                    pausedForLeaderboard
                      ? styles.overlayButtonSecondaryText
                      : styles.overlayButtonText
                  }
                >
                  Yeniden Basla
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: BOARD_SIDE_PADDING,
    paddingBottom: 10,
    gap: 8,
  },

  // Üst panel
  topPanel: {
    paddingTop: 4,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    color: APP_COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  headerIconButton: {
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  headerIconText: {
    fontSize: 18,
  },
  scoreBadge: {
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    minWidth: 62,
  },
  scoreBadgeLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  scoreBadgeValue: {
    color: APP_COLORS.accentSoft,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 6,
  },
  statCard: {
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    gap: 2,
  },
  statCardLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statCardBig: {
    color: APP_COLORS.accentSoft,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
  },
  statCardSub: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  wrongDots: {
    flexDirection: "row",
    gap: 5,
    marginVertical: 2,
  },
  wrongDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: APP_COLORS.border,
    borderWidth: 1,
    borderColor: APP_COLORS.textMuted,
  },
  wrongDotFilled: {
    backgroundColor: APP_COLORS.danger,
    borderColor: APP_COLORS.danger,
  },

  // Seçim bölümü
  selectionSection: {
    gap: 6,
  },
  selectionChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  selectionChip: {
    flex: 1,
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 1,
  },
  selectionChipSuccess: {
    borderColor: APP_COLORS.success,
  },
  selectionChipLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  selectionChipValue: {
    color: APP_COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedValuesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 34,
    maxHeight: 34,
    alignItems: "flex-start",
    alignContent: "flex-start",
    overflow: "hidden",
  },
  selectedValuesSpacer: {
    height: 28,
    width: "100%",
  },
  selectedValuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedValueOrder: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
    opacity: 0.8,
  },
  selectedValueText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },

  // Durum paneli
  statusPanel: {
    backgroundColor: APP_COLORS.panelSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  statusPanelDanger: {
    borderColor: APP_COLORS.danger,
    backgroundColor: "#321925",
  },
  statusPanelSuccess: {
    borderColor: APP_COLORS.success,
    backgroundColor: "#163126",
  },
  statusText: {
    color: APP_COLORS.text,
    fontSize: 11,
    lineHeight: 14,
  },

  // Kontroller
  controlsRow: {
    flexDirection: "row",
    gap: 6,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: APP_COLORS.accent,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingVertical: 6,
  },
  primaryButtonText: {
    color: "#2b1900",
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButtonTextDisabled: {
    color: "#332100",
  },
  buttonDisabled: {
    backgroundColor: "#b89a52",
    opacity: 0.7,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: APP_COLORS.panel,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  secondaryButtonText: {
    color: APP_COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  // Tahta
  boardShell: {
    flex: 1,
    justifyContent: "center",
  },
  board: {
    backgroundColor: APP_COLORS.panel,
    borderRadius: 20,
    borderColor: APP_COLORS.border,
    borderWidth: 1,
    padding: BOARD_INNER_PADDING,
    alignSelf: "center",
  },
  boardRow: {
    flexDirection: "row",
    marginBottom: BOARD_GAP,
  },
  cell: {
    borderRadius: 14,
    backgroundColor: APP_COLORS.emptyCell,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: APP_COLORS.selection,
    backgroundColor: "#173146",
  },
  fallingOverlay: {
    position: "absolute",
  },

  // Blok görünümü
  blockToken: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
  },
  blockSheen: {
    position: "absolute",
    top: 3,
    left: 4,
    right: 4,
    height: "36%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  blockValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  blockValueSmall: {
    fontSize: 14,
  },
  blockIndex: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },

  // Overlay (game over & leaderboard ortak)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,10,18,0.93)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlayCard: {
    width: "88%",
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: 28,
    alignItems: "center",
    gap: 14,
  },
  overlayTitle: {
    color: APP_COLORS.accentSoft,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 2,
    textAlign: "center",
  },
  overlayScore: {
    color: APP_COLORS.text,
    fontSize: 56,
    fontWeight: "900",
    lineHeight: 60,
    marginTop: 4,
  },
  overlayScoreLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: -6,
  },
  nameInput: {
    width: "100%",
    backgroundColor: APP_COLORS.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    color: APP_COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: "center",
  },
  overlayButton: {
    width: "100%",
    backgroundColor: APP_COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13,
  },
  overlayButtonText: {
    color: "#2b1900",
    fontSize: 14,
    fontWeight: "800",
  },
  overlayButtonSecondary: {
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: "center",
    paddingVertical: 11,
  },
  overlayButtonSecondaryText: {
    color: APP_COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  // Liderlik tablosu
  leaderboardCard: {
    width: "92%",
    maxHeight: "85%",
    backgroundColor: APP_COLORS.panelAlt,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    padding: 20,
    alignItems: "center",
    gap: 14,
  },
  leaderboardScroll: {
    width: "100%",
    maxHeight: 340,
  },
  emptyText: {
    color: APP_COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 20,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: APP_COLORS.panel,
    borderRadius: 12,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    gap: 10,
  },
  leaderboardRowFirst: {
    borderColor: APP_COLORS.accent,
    backgroundColor: "#1a2b10",
  },
  leaderboardRank: {
    color: APP_COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    width: 28,
  },
  leaderboardRankFirst: {
    color: APP_COLORS.accentSoft,
    fontSize: 14,
  },
  leaderboardInfo: {
    flex: 1,
    gap: 1,
  },
  leaderboardName: {
    color: APP_COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  leaderboardDate: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
  },
  leaderboardScore: {
    color: APP_COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  leaderboardScoreFirst: {
    color: APP_COLORS.accentSoft,
    fontSize: 18,
  },
});

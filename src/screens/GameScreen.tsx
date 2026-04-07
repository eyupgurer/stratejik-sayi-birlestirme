import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  APP_COLORS,
  BLOCK_COLORS,
  BOARD_COLUMNS,
  FALL_STEP_INTERVAL_MS,
  MAX_SELECTION_LENGTH,
  MIN_SELECTION_LENGTH,
  NEW_BLOCK_INTERVAL_MS,
} from "../constants/game";
import { Board, FallingBlock, Position } from "../types/game";
import {
  areAdjacent,
  areSamePosition,
  canMoveFallingBlock,
  collapseBoard,
  createInitialBoard,
  generateTargetNumber,
  getBlockAt,
  getSelectionScore,
  getSelectionSum,
  isSelectionChainValid,
  placeFallingBlock,
  refillBoardAfterClear,
  removeSelectedBlocks,
  spawnFallingBlock,
} from "../utils/game";

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
      <Text style={[styles.blockValue, size < 28 && styles.blockValueSmall]}>{block.value}</Text>
      {selectionIndex > 0 ? <Text style={styles.blockIndex}>{selectionIndex}</Text> : null}
    </View>
  );
}

function SelectionChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <View
      style={[
        styles.selectionChip,
        tone === "danger" && styles.selectionChipDanger,
        tone === "success" && styles.selectionChipSuccess,
      ]}
    >
      <Text style={styles.selectionChipLabel}>{label}</Text>
      <Text style={styles.selectionChipValue}>{value}</Text>
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
  const [statusText, setStatusText] = useState(
    "Vize asamasi icin temel oyun mekanigi hazir.",
  );
  const [statusTone, setStatusTone] = useState<"neutral" | "danger" | "success">("neutral");
  const [targetNumber, setTargetNumber] = useState(() =>
    generateTargetNumber(initialBoardRef.current!),
  );

  const boardRef = useRef(board);
  const fallingBlockRef = useRef(fallingBlock);
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
    const spawnTimer = setInterval(() => {
      if (fallingBlockRef.current) {
        return;
      }

      const nextFallingBlock = spawnFallingBlock(boardRef.current);
      if (!nextFallingBlock) {
        setStatus("Yeni blok icin bos sutun kalmadi.", "danger");
        return;
      }

      setFallingBlock(nextFallingBlock);
      setStatus("Yeni blok yukaridan dusuyor.");
    }, NEW_BLOCK_INTERVAL_MS);

    return () => clearInterval(spawnTimer);
  }, []);

  useEffect(() => {
    const fallingTimer = setInterval(() => {
      const current = fallingBlockRef.current;
      if (!current) {
        return;
      }

      if (canMoveFallingBlock(boardRef.current, current)) {
        setFallingBlock({
          ...current,
          row: current.row + 1,
        });
        return;
      }

      const nextBoard = placeFallingBlock(boardRef.current, current);
      setBoard(nextBoard);
      setTargetNumber((previousTarget) => previousTarget || generateTargetNumber(nextBoard));
      setFallingBlock(null);
      setStatus("Blok yerine yerlesti.");
    }, FALL_STEP_INTERVAL_MS);

    return () => clearInterval(fallingTimer);
  }, []);

  const outerBoardWidth = width - BOARD_SIDE_PADDING * 2;
  const isCompactLayout = width < 420;
  const isNarrowLayout = width < 390;
  const widthBasedCellSize = Math.floor(
    (outerBoardWidth - 20 - BOARD_GAP * (BOARD_COLUMNS - 1)) / BOARD_COLUMNS,
  );
  const estimatedTopArea = isNarrowLayout ? 260 : isCompactLayout ? 224 : 204;
  const heightBasedCellSize = Math.floor(
    (height - insets.top - insets.bottom - estimatedTopArea - BOARD_GAP * 9 - 20) / 10,
  );
  const cellSize = Math.max(24, Math.min(widthBasedCellSize, heightBasedCellSize));
  const cellStep = cellSize + BOARD_GAP;
  const boardWidth = cellSize * BOARD_COLUMNS + BOARD_GAP * (BOARD_COLUMNS - 1) + BOARD_INNER_PADDING * 2;

  useEffect(() => {
    if (!fallingBlock) {
      activeFallingBlockIdRef.current = null;
      fallingOpacity.setValue(0);
      fallingScale.setValue(0.88);
      fallingTranslateY.setValue(0);
      return;
    }

    const nextTranslateY = fallingBlock.row * cellStep;

    if (activeFallingBlockIdRef.current !== fallingBlock.block.id) {
      activeFallingBlockIdRef.current = fallingBlock.block.id;
      fallingTranslateY.setValue(nextTranslateY);
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
        toValue: nextTranslateY,
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
  }, [
    cellStep,
    fallingBlock,
    fallingOpacity,
    fallingScale,
    fallingTranslateY,
  ]);

  const selectedSum = getSelectionSum(board, selectedPositions);
  const selectionValid = isSelectionChainValid(selectedPositions);
  const confirmEnabled =
    !fallingBlockRef.current &&
    selectedPositions.length >= MIN_SELECTION_LENGTH &&
    selectionValid;
  const selectedValues = selectedPositions
    .map((position) => getBlockAt(board, position)?.value)
    .filter((value): value is number => value !== undefined);
  const wrongAttemptsLeft = Math.max(0, 3 - wrongAttempts);
  const targetMetaText = `Secim toplami ${selectedSum}  •  Yanlis ${wrongAttempts}  •  Hak ${wrongAttemptsLeft}`;
  const selectionHintText =
    selectedPositions.length === 0
      ? "Bekleniyor"
      : selectedSum === targetNumber && selectionValid
        ? "Hazir"
        : "Secim var";
  const selectionStatusText =
    selectedPositions.length < MIN_SELECTION_LENGTH
      ? "Bekliyor"
      : selectedSum === targetNumber && selectionValid
        ? "Hazir"
        : "Devam";

  function setStatus(message: string, tone: "neutral" | "danger" | "success" = "neutral") {
    setStatusText(message);
    setStatusTone(tone);
  }

  function resetSelection() {
    setSelectedPositions([]);
    setStatus("Secim sifirlandi.");
  }

  function handleCellPress(position: Position) {
    if (fallingBlockRef.current) {
      setStatus("Blok dusuyorken secim kapali.");
      return;
    }

    const block = getBlockAt(board, position);
    if (!block) {
      return;
    }

    setSelectedPositions((currentSelection) => {
      if (currentSelection.some((item) => areSamePosition(item, position))) {
        setStatus("Ayni hamlede bir blok yalnizca bir kez secilebilir.", "danger");
        return currentSelection;
      }

      if (currentSelection.length >= MAX_SELECTION_LENGTH) {
        setStatus("Bir hamlede en fazla 4 blok secebilirsin.", "danger");
        return currentSelection;
      }

      if (currentSelection.length === 0) {
        setStatus("Ilk blok secildi.");
        return [position];
      }

      const lastSelected = currentSelection[currentSelection.length - 1];
      if (!lastSelected || !areAdjacent(lastSelected, position)) {
        setStatus("Yeni blok, zincirdeki son bloga komsu olmali.", "danger");
        return currentSelection;
      }

      setStatus("Zincire yeni blok eklendi.");
      return [...currentSelection, position];
    });
  }

  function handleConfirmSelection() {
    if (fallingBlockRef.current) {
      setStatus("Blok dusuyorken hamle onaylanamaz.", "danger");
      return;
    }

    if (!selectionValid) {
      setStatus(
        `Hamle icin ${MIN_SELECTION_LENGTH}-${MAX_SELECTION_LENGTH} arasi komsu blok secmelisin.`,
        "danger",
      );
      return;
    }

    if (selectedSum !== targetNumber) {
      setWrongAttempts((current) => current + 1);
      setSelectedPositions([]);
      setStatus(`Yanlis hamle. Hedef ${targetNumber}, secim toplami ${selectedSum}.`, "danger");
      return;
    }

    const clearedBoard = removeSelectedBlocks(board, selectedPositions);
    const collapsedBoard = collapseBoard(clearedBoard);
    const refilledBoard = refillBoardAfterClear(collapsedBoard, selectedPositions.length);
    const gainedScore = getSelectionScore(board, selectedPositions);

    setBoard(refilledBoard);
    setScore((current) => current + gainedScore);
    setTargetNumber(generateTargetNumber(refilledBoard));
    setSelectedPositions([]);
    setStatus(`Dogru hamle. ${gainedScore} puanlik blok temizlendi.`, "success");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.topPanel}>
          <Text style={styles.title}>Stratejik Sayi Birlestirme</Text>

          <View style={styles.targetSpotlight}>
            <Text style={styles.targetSpotlightLabel}>Hedef</Text>
            <Text style={styles.targetSpotlightValue}>{targetNumber}</Text>
            <Text style={styles.targetSpotlightHint}>{selectionHintText}</Text>
            <Text style={styles.targetMeta}>{targetMetaText}</Text>
          </View>

          <View style={styles.selectionSection}>
            <View style={styles.selectionChipRow}>
              <SelectionChip label="Secilen" value={`${selectedPositions.length}/4`} />
              <SelectionChip
                label="Durum"
                value={selectionStatusText}
                tone={selectedSum === targetNumber && selectionValid ? "success" : "default"}
              />
            </View>

            <View style={styles.selectedValuesRow}>
              {selectedValues.length > 0 ? (
                selectedValues.map((value, index) => (
                  <View
                    key={`selected-value-${index}`}
                    style={[styles.selectedValuePill, { backgroundColor: BLOCK_COLORS[value] }]}
                  >
                    <Text style={styles.selectedValueOrder}>{index + 1}</Text>
                    <Text style={styles.selectedValueText}>{value}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.selectedValuesSpacer} />
              )}
            </View>
          </View>

          <View style={styles.statusRow}>
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
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              onPress={handleConfirmSelection}
              style={[styles.primaryButton, !confirmEnabled && styles.buttonDisabled]}
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

        <View style={styles.boardShell}>
          <View style={[styles.board, { width: boardWidth }]}>
            {board.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.boardRow}>
                {row.map((block, colIndex) => {
                  const position = { row: rowIndex, col: colIndex };
                  const isSelected = selectedPositions.some((item) => areSamePosition(item, position));
                  const selectionIndex = isSelected
                    ? selectedPositions.findIndex((item) => areSamePosition(item, position)) + 1
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
                          marginRight: colIndex === BOARD_COLUMNS - 1 ? 0 : BOARD_GAP,
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
                    transform: [{ translateY: fallingTranslateY }, { scale: fallingScale }],
                  },
                ]}
              >
                <BlockFace block={fallingBlock.block} size={cellSize} selectionIndex={0} />
              </Animated.View>
            ) : null}
          </View>
        </View>
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
    gap: 10,
  },
  topPanel: {
    paddingTop: 4,
    gap: 6,
  },
  title: {
    color: APP_COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  targetSpotlight: {
    width: "100%",
    minWidth: 0,
    borderRadius: 22,
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  targetSpotlightLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  targetSpotlightValue: {
    color: APP_COLORS.accentSoft,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 2,
  },
  targetSpotlightHint: {
    color: APP_COLORS.text,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 2,
  },
  targetMeta: {
    color: APP_COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
  selectionSection: {
    gap: 8,
  },
  selectionChipRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
  },
  selectionChip: {
    flex: 1,
    backgroundColor: APP_COLORS.panel,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
    minWidth: 0,
    gap: 2,
  },
  selectionChipDanger: {
    borderColor: APP_COLORS.danger,
  },
  selectionChipSuccess: {
    borderColor: APP_COLORS.success,
  },
  selectionChipLabel: {
    color: APP_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  selectionChipValue: {
    color: APP_COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
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
    fontSize: 15,
  },
  blockIndex: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 1,
  },
  selectedValuesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    minHeight: 56,
    maxHeight: 56,
    alignItems: "flex-start",
    alignContent: "flex-start",
    overflow: "hidden",
  },
  selectedValuesSpacer: {
    height: 48,
    width: "100%",
  },
  selectedValuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selectedValueOrder: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    opacity: 0.85,
  },
  selectedValueText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  statusRow: {
    width: "100%",
  },
  statusPanel: {
    backgroundColor: APP_COLORS.panelSoft,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    justifyContent: "center",
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
    fontSize: 12,
    lineHeight: 16,
  },
  controlsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 6,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: APP_COLORS.accent,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
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
    opacity: 0.9,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: APP_COLORS.panel,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  secondaryButtonText: {
    color: APP_COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
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
    borderRadius: 16,
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
});

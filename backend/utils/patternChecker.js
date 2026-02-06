// Pattern checker for bingo game
export function checkWinningPattern(
  card,
  calledNumbers,
  pattern = "1line",
  currentNumber
) {
  const columns = ["B", "I", "N", "G", "O"];
  const size = 5;

  // Helper function to check if a number is called
  const isCalled = (num) => calledNumbers.includes(num);

  // Helper function to get number at position
  const getNumberAt = (row, col) => {
    const column = columns[col];
    return card[column][row];
  };

  // Helper function to check if a cell is marked (called or free space)
  const isMarked = (row, col) => {
    if (row === 2 && col === 2) return true; // Always free
    const num = getNumberAt(row, col);
    if (num === 0 || num === null || String(num) === "FREE") return true;
    return isCalled(num);
  };

  // Check rows (horizontal lines)
  const winningRows = [];
  for (let row = 0; row < size; row++) {
    let rowWin = true;
    const rowCells = [];

    for (let col = 0; col < size; col++) {
      if (!isMarked(row, col)) {
        rowWin = false;
        break;
      }
      rowCells.push({ row, col });
    }

    if (rowWin) {
      winningRows.push(rowCells);
    }
  }

  // Check columns (vertical lines)
  const winningColumns = [];
  for (let col = 0; col < size; col++) {
    let colWin = true;
    const colCells = [];

    for (let row = 0; row < size; row++) {
      if (!isMarked(row, col)) {
        colWin = false;
        break;
      }
      colCells.push({ row, col });
    }

    if (colWin) {
      winningColumns.push(colCells);
    }
  }

  // Check diagonals
  const winningDiagonals = [];

  // Diagonal 1: Top-left to bottom-right
  let diag1Win = true;
  const diag1Cells = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, i)) {
      diag1Win = false;
      break;
    }
    diag1Cells.push({ row: i, col: i });
  }
  if (diag1Win) {
    winningDiagonals.push(diag1Cells);
  }

  // Diagonal 2: Top-right to bottom-left
  let diag2Win = true;
  const diag2Cells = [];
  for (let i = 0; i < size; i++) {
    if (!isMarked(i, size - 1 - i)) {
      diag2Win = false;
      break;
    }
    diag2Cells.push({ row: i, col: size - 1 - i });
  }
  if (diag2Win) {
    winningDiagonals.push(diag2Cells);
  }

  // Check X pattern (both diagonals)
  const xPatternCells = [];
  if (diag1Win && diag2Win) {
    xPatternCells.push(...diag1Cells, ...diag2Cells);
  }

  // Check outer square pattern (4 corners only)
  const outerSquareCells = [];
  let outerSquareWin = true;

  const corners = [
    { row: 0, col: 0 }, // Top-left
    { row: 0, col: 4 }, // Top-right
    { row: 4, col: 0 }, // Bottom-left
    { row: 4, col: 4 }, // Bottom-right
  ];

  for (const corner of corners) {
    if (!isMarked(corner.row, corner.col)) {
      outerSquareWin = false;
      break;
    }
    outerSquareCells.push(corner);
  }

  // Check inner square pattern (4 corners of 3x3 center area only) - also called Center Four Corner
  const innerSquareCells = [];
  let innerSquareWin = true;

  const innerCorners = [
    { row: 1, col: 1 }, // Top-left of inner area
    { row: 1, col: 3 }, // Top-right of inner area
    { row: 3, col: 1 }, // Bottom-left of inner area
    { row: 3, col: 3 }, // Bottom-right of inner area
  ];

  for (const corner of innerCorners) {
    if (!isMarked(corner.row, corner.col)) {
      innerSquareWin = false;
      break;
    }
    innerSquareCells.push(corner);
  }

  // Check Center T pattern (free center + 4 adjacent cells forming a plus/cross)
  // Pattern:    [1,2]
  //         [2,1][2,2][2,3]
  //             [3,2]
  const centerTCells = [
    { row: 1, col: 2 }, // Top of center
    { row: 2, col: 1 }, // Left of center
    { row: 2, col: 2 }, // Center (FREE)
    { row: 2, col: 3 }, // Right of center
    { row: 3, col: 2 }, // Bottom of center
  ];
  let centerTWin = true;
  for (const cell of centerTCells) {
    if (!isMarked(cell.row, cell.col)) {
      centerTWin = false;
      break;
    }
  }

  // Check L patterns (4 orientations)
  // L can be in any of the 4 corners
  const lPatterns = [
    // Bottom-left L: First column + Bottom row
    [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
    ],
    // Bottom-right L: Last column + Bottom row
    [
      { row: 0, col: 4 },
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 3, col: 4 },
      { row: 4, col: 4 },
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
    ],
    // Top-left L: First column + Top row
    [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ],
    // Top-right L: Last column + Top row
    [
      { row: 0, col: 4 },
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 3, col: 4 },
      { row: 4, col: 4 },
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ],
  ];

  let lPatternWin = false;
  let winningLPatternCells = [];

  for (const lCells of lPatterns) {
    let lWin = true;
    for (const cell of lCells) {
      if (!isMarked(cell.row, cell.col)) {
        lWin = false;
        break;
      }
    }
    if (lWin) {
      lPatternWin = true;
      winningLPatternCells = lCells;
      break;
    }
  }

  // Helper function to check if current number is part of winning pattern
  const checkCurrentNumberInPattern = (winningCells) => {
    if (!currentNumber) return "win";

    const hasCurrentNumberInPattern = winningCells.some(({ row, col }) => {
      const num = card[columns[col]][row];
      return num === currentNumber;
    });

    if (!hasCurrentNumberInPattern) {
      console.log(
        `🔍 "not_now" detected: currentNumber=${currentNumber}, winningCells=${winningCells.length} cells`
      );
    }

    return hasCurrentNumberInPattern ? "win" : "not_now";
  };

  // Helper to count total completed line patterns (rows, columns, diagonals)
  const countLinePatterns = () => {
    return winningRows.length + winningColumns.length + winningDiagonals.length;
  };

  // Helper to get all line pattern cells
  const getAllLinePatternCells = () => {
    const cells = [];
    cells.push(...winningRows.flat());
    cells.push(...winningColumns.flat());
    cells.push(...winningDiagonals.flat());
    return cells;
  };

  // Check specific patterns
  switch (pattern) {
    case "1line": {
      const lineCount = countLinePatterns();
      const isWinner = lineCount >= 1;

      if (isWinner) {
        const winningCells = getAllLinePatternCells();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "2line": {
      const lineCount = countLinePatterns();
      const isWinner = lineCount >= 2;

      if (isWinner) {
        const winningCells = getAllLinePatternCells();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "3line": {
      const lineCount = countLinePatterns();
      const isWinner = lineCount >= 3;

      if (isWinner) {
        const winningCells = getAllLinePatternCells();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "4line": {
      const lineCount = countLinePatterns();
      const isWinner = lineCount >= 4;

      if (isWinner) {
        const winningCells = getAllLinePatternCells();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "anyVertical": {
      const isWinner = winningColumns.length >= 1;
      if (isWinner) {
        const winningCells = winningColumns.flat();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "anyHorizontal": {
      const isWinner = winningRows.length >= 1;
      if (isWinner) {
        const winningCells = winningRows.flat();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }

    case "lPattern": {
      const status = lPatternWin
        ? checkCurrentNumberInPattern(winningLPatternCells)
        : "lose";
      return {
        isWinner: lPatternWin,
        winningCells: winningLPatternCells,
        status,
      };
    }

    case "x": {
      const isWinner = diag1Win && diag2Win;
      const status = isWinner
        ? checkCurrentNumberInPattern(xPatternCells)
        : "lose";
      return { isWinner, winningCells: xPatternCells, status };
    }

    case "centerT": {
      const status = centerTWin
        ? checkCurrentNumberInPattern(centerTCells)
        : "lose";
      return {
        isWinner: centerTWin,
        winningCells: centerTCells,
        status,
      };
    }

    case "centerFourCorner": {
      const status = innerSquareWin
        ? checkCurrentNumberInPattern(innerSquareCells)
        : "lose";
      return {
        isWinner: innerSquareWin,
        winningCells: innerSquareCells,
        status,
      };
    }

    case "diagonals": {
      const isWinner = winningDiagonals.length >= 1;
      const winningCells = winningDiagonals.flat();
      const status = isWinner
        ? checkCurrentNumberInPattern(winningCells)
        : "lose";
      return { isWinner, winningCells, status };
    }

    case "outerSquare": {
      const status = outerSquareWin
        ? checkCurrentNumberInPattern(outerSquareCells)
        : "lose";
      return {
        isWinner: outerSquareWin,
        winningCells: outerSquareCells,
        status,
      };
    }

    case "innerSquare": {
      const status = innerSquareWin
        ? checkCurrentNumberInPattern(innerSquareCells)
        : "lose";
      return {
        isWinner: innerSquareWin,
        winningCells: innerSquareCells,
        status,
      };
    }

    default: {
      // Default to 1 line pattern
      const lineCount = countLinePatterns();
      const isWinner = lineCount >= 1;

      if (isWinner) {
        const winningCells = getAllLinePatternCells();
        const uniqueWinningCells = [
          ...new Map(
            winningCells.map((cell) => [`${cell.row}-${cell.col}`, cell])
          ).values(),
        ];
        const status = checkCurrentNumberInPattern(uniqueWinningCells);
        return { isWinner, winningCells: uniqueWinningCells, status };
      }
      return { isWinner: false, winningCells: [], status: "lose" };
    }
  }
}

// Export available patterns for reference
export const BINGO_PATTERNS = {
  "1line": "1 Line",
  "2line": "2 Lines",
  "3line": "3 Lines",
  "4line": "4 Lines",
  anyVertical: "Any Vertical Line",
  anyHorizontal: "Any Horizontal Line",
  lPattern: "L Pattern",
  x: "X Pattern",
  centerT: "Center T Pattern",
  centerFourCorner: "Center Four Corner",
};

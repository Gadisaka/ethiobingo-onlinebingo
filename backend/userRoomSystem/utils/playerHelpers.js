import User from "../../model/user.js";

const extractPlayerId = (player) => {
  if (!player) return null;
  if (typeof player === "string") return player;
  if (player._id) return String(player._id);
  if (player.id) return String(player.id);
  if (player.userId) return String(player.userId);
  if (player.toString) return player.toString();
  return null;
};

const toPlainPlayer = (player) => {
  if (!player) return player;
  if (typeof player.toObject === "function") {
    const plain = player.toObject();
    return { ...plain, _id: String(plain._id), id: String(plain._id) };
  }
  return player;
};

export async function hydratePlayerSummaries(players = []) {
  const ids = Array.from(
    new Set(
      players
        .map((player) => extractPlayerId(player))
        .filter((id) => id !== null)
    )
  );

  let users = [];
  if (ids.length > 0) {
    users = await User.find({ _id: { $in: ids } })
      .select("name phoneNumber")
      .lean();
  }

  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return players.map((player) => {
    if (player && typeof player === "object" && player.name) {
      const id = extractPlayerId(player);
      const plain = toPlainPlayer(player);
      return {
        ...plain,
        _id: id ?? plain._id ?? plain.id ?? plain.userId ?? null,
        id: id ?? plain.id ?? plain._id ?? plain.userId ?? null,
        name: plain.name,
        phoneNumber: plain.phoneNumber ?? "",
      };
    }

    const id = extractPlayerId(player);
    const user = id ? userMap.get(id) : null;

    return {
      _id: id,
      id,
      name: user?.name ?? "",
      phoneNumber: user?.phoneNumber ?? "",
    };
  });
}



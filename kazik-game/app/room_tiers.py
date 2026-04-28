ROOM_TIER_RULES = {
    "bronze": {
        "min_entry_fee": 100,
        "max_entry_fee": 499,
        "label": "Bronze",
        "accent": "#cd7f32",
    },
    "silver": {
        "min_entry_fee": 500,
        "max_entry_fee": 1499,
        "label": "Silver",
        "accent": "#c0c0c0",
    },
    "gold": {
        "min_entry_fee": 1500,
        "max_entry_fee": 3499,
        "label": "Gold",
        "accent": "#f6c453",
    },
    "platinum": {
        "min_entry_fee": 3500,
        "max_entry_fee": 999999,
        "label": "Platinum",
        "accent": "#d9e4f5",
    },
}


def resolve_room_tier(entry_fee: int) -> str:
    for tier, rule in ROOM_TIER_RULES.items():
        if rule["min_entry_fee"] <= entry_fee <= rule["max_entry_fee"]:
            return tier
    return "silver"

from airports import all_airports, get_by_iata, search_airports


def test_exact_iata_returns_berlin_first():
    results = search_airports("BER")
    assert results, "expected at least one result for BER"
    assert results[0]["iata"] == "BER"
    assert results[0]["city"] == "Berlin"


def test_iata_prefix_returns_multiple():
    results = search_airports("LH", limit=10)
    assert len(results) > 1, "expected multiple LH*-prefixed airports"
    assert all(r["iata"].startswith("LH") for r in results)


def test_city_prefix_paris_top3_contains_major_airport():
    results = search_airports("paris", limit=3)
    iatas = [r["iata"] for r in results]
    assert "CDG" in iatas or "ORY" in iatas, f"expected CDG or ORY in top 3, got {iatas}"


def test_city_search_is_case_insensitive():
    assert search_airports("PARIS") == search_airports("paris")


def test_limit_is_respected():
    results = search_airports("a", limit=3)
    assert len(results) == 3


def test_empty_query_returns_empty_list():
    assert search_airports("") == []


def test_whitespace_only_query_returns_empty_list():
    assert search_airports("   ") == []


def test_get_by_iata_known_code():
    row = get_by_iata("BER")
    assert row is not None
    assert row["city"] == "Berlin"


def test_get_by_iata_unknown_code_returns_none():
    assert get_by_iata("ZZZ") is None


def test_get_by_iata_is_case_insensitive():
    assert get_by_iata("ber") == get_by_iata("BER")


def test_filtered_dataset_size_is_reasonable():
    size = len(all_airports())
    assert 4000 <= size <= 15000, f"filtered dataset size {size} out of expected range"


def test_normalized_row_has_required_fields():
    results = search_airports("BER")
    assert results
    row = results[0]
    for field in ("iata", "icao", "name", "city", "country", "country_name", "region", "tz"):
        assert field in row, f"missing field: {field}"
    assert row["region"] == "Europe"
    assert row["country"] == "DE"
    assert row["country_name"] == "Germany"

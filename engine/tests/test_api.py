def test_public_api_exports():
    import capacity_engine as ce
    # smoke test the curated surface used by the server/skill later
    for name in [
        "Org", "Team", "Engineer", "Deliverable", "Estimate",
        "effective_capacity", "gross_person_months", "net_person_months",
        "total_demand", "compute_fit", "apply_scenario", "detect_risks",
        "validate_org", "load_org", "save_org",
    ]:
        assert hasattr(ce, name), f"missing public export: {name}"

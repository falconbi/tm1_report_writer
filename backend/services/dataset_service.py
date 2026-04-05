from datetime import datetime, timezone
from core.tm1_connect import tm1_connect


def fetch_dataset(cube: str, view: str, args: dict = None):
    """
    Execute a TM1 view and return a structured dataset.
    If overrides dict is provided, uses MDX with WHERE clause to slice differently.
    """
    import json
    if args is None:
        args = {}

    overrides = {}
    try:
        overrides = json.loads(args.get('overrides', '{}'))
    except Exception:
        pass

    session = tm1_connect.get_session()
    base = tm1_connect.get_base_url()

    try:
        if overrides:
            return _fetch_with_mdx(session, base, cube, view, overrides)
        else:
            return _fetch_native(session, base, cube, view)
    except Exception as e:
        raise Exception(f"Dataset fetch failed for {cube}/{view}: {str(e)}")


def _fetch_native(session, base, cube, view):
    """Execute the view directly — no overrides."""
    r = session.post(
        f"{base}/Cubes('{cube}')/Views('{view}')/tm1.Execute",
        json={}, timeout=30
    )
    r.raise_for_status()
    return _read_cellset(session, base, r.json()['ID'], cube, view, {})


def _fetch_with_mdx(session, base, cube, view, overrides: dict):
    """
    Build MDX from the view's axes then inject a WHERE clause with overrides.
    """
    # First get the native cellset to read the axis structure
    r = session.post(
        f"{base}/Cubes('{cube}')/Views('{view}')/tm1.Execute",
        json={}, timeout=30
    )
    r.raise_for_status()
    cid = r.json()['ID']

    try:
        r_axes = session.get(
            f"{base}/Cellsets('{cid}')/Axes?"
            "$expand=Hierarchies($select=Name),Tuples($expand=Members($select=Name))",
            timeout=20
        )
        r_axes.raise_for_status()
        axes_raw = r_axes.json()['value']
    finally:
        try:
            session.delete(f"{base}/Cellsets('{cid}')")
        except Exception:
            pass

    # Build WHERE clause — use override value if provided, else default from view
    where_parts = []
    if len(axes_raw) > 2:
        for member_item in axes_raw[2]['Tuples'][0].get('Members', []):
            dim = member_item['Name']
            # Find hierarchy name for this member's dimension
            hier = next(
                (h['Name'] for h in axes_raw[2].get('Hierarchies', [])
                 if h['Name'] == dim),
                dim
            )
            value = overrides.get(dim, dim)
            where_parts.append(f"[{hier}].[{value}]")

    # Build column and row set expressions from axis tuples
    col_members = [
        ' * '.join(f"[{h['Name']}].[{m['Name']}]"
                   for h, m in zip(axes_raw[0].get('Hierarchies', []),
                                   t.get('Members', [])))
        for t in axes_raw[0].get('Tuples', [])
    ]
    row_members = [
        ' * '.join(f"[{h['Name']}].[{m['Name']}]"
                   for h, m in zip(axes_raw[1].get('Hierarchies', []),
                                   t.get('Members', [])))
        for t in axes_raw[1].get('Tuples', [])
    ]

    col_set = '{' + ', '.join(col_members) + '}'
    row_set = '{' + ', '.join(row_members) + '}'
    where_clause = f"WHERE ({', '.join(where_parts)})" if where_parts else ''

    mdx = f"SELECT {col_set} ON 0, {row_set} ON 1 FROM [{cube}] {where_clause}"

    r_mdx = session.post(
        f"{base}/ExecuteMDX",
        json={"MDX": mdx},
        timeout=30
    )
    r_mdx.raise_for_status()
    return _read_cellset(session, base, r_mdx.json()['ID'], cube, view, overrides)


def _read_cellset(session, base, cid, cube, view, overrides):
    """Read axes and cells from an open cellset, then delete it."""
    try:
        r_axes = session.get(
            f"{base}/Cellsets('{cid}')/Axes?"
            "$expand=Hierarchies($select=Name),Tuples($expand=Members($select=Name))",
            timeout=20
        )
        r_axes.raise_for_status()
        axes_raw = r_axes.json()['value']

        n_cols = len(axes_raw[0]['Tuples'])
        n_rows = len(axes_raw[1]['Tuples'])

        r_cells = session.get(
            f"{base}/Cellsets('{cid}')/Cells?$select=Value&$top={n_cols * n_rows + 100}",
            timeout=20
        )
        r_cells.raise_for_status()
        cells_flat = [c.get('Value') for c in r_cells.json().get('value', [])]
        cells = [cells_flat[i * n_cols:(i + 1) * n_cols] for i in range(n_rows)]

        def parse_axis(axis):
            return {
                'hierarchies': [h['Name'] for h in axis.get('Hierarchies', [])],
                'tuples': [
                    {'members': [m['Name'] for m in t.get('Members', [])]}
                    for t in axis.get('Tuples', [])
                ]
            }

        axes = [parse_axis(a) for a in axes_raw]

        # Build context string using overrides where available
        context_parts = []
        if len(axes_raw) > 2 and axes_raw[2].get('Tuples'):
            for i, member in enumerate(axes_raw[2]['Tuples'][0].get('Members', [])):
                dim = axes_raw[2]['Hierarchies'][i]['Name'] if i < len(axes_raw[2].get('Hierarchies', [])) else member['Name']
                value = overrides.get(dim, member['Name'])
                context_parts.append(value)
        context = ' · '.join(context_parts)

        return {
            'status': 'ok',
            'cube': cube,
            'view': view,
            'context': context,
            'extractedAt': datetime.now(timezone.utc).isoformat(),
            'axes': axes,
            'cells': cells,
            'overrides': overrides,
        }

    finally:
        try:
            session.delete(f"{base}/Cellsets('{cid}')")
        except Exception:
            pass

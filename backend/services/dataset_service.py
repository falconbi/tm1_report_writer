from datetime import datetime, timezone
import json
from core.tm1_connect import tm1_connect

def fetch_dataset(cube: str, view: str, args: dict = None):
    """
    Final improved version with overrides and basic alias placeholders.
    """
    if args is None:
        args = {}

    overrides = {}
    row_alias_dims = {}
    col_alias_dims = {}

    try:
        overrides = json.loads(args.get('overrides', '{}'))
    except:
        pass
    try:
        row_alias_dims = json.loads(args.get('rowAliases', '{}'))
    except:
        pass
    try:
        col_alias_dims = json.loads(args.get('colAliases', '{}'))
    except:
        pass

    try:
        session = tm1_connect.get_session()
        base = tm1_connect.get_base_url()

        r = session.post(f"{base}/Cubes('{cube}')/Views('{view}')/tm1.Execute", json={}, timeout=30)
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

            # Context with overrides
            context_parts = []
            if len(axes_raw) > 2 and axes_raw[2].get('Tuples'):
                for member in axes_raw[2]['Tuples'][0].get('Members', []):
                    dim = member.get('Name', '')
                    value = overrides.get(dim, member.get('Name', ''))
                    context_parts.append(value)
            context = ' · '.join(context_parts) if context_parts else ''

            return {
                'status': 'ok',
                'cube': cube,
                'view': view,
                'context': context,
                'extractedAt': datetime.now(timezone.utc).isoformat(),
                'axes': axes,
                'cells': cells,
                'overrides': overrides,
                'overridesApplied': bool(overrides),
                'rowAliases': row_alias_dims,
                'colAliases': col_alias_dims
            }

        finally:
            try:
                session.delete(f"{base}/Cellsets('{cid}')")
            except:
                pass

    except Exception as e:
        raise Exception(f"Dataset fetch failed for {cube}/{view}: {str(e)}")

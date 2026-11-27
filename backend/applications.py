"""Query only the built-in application fixtures using the active calibration model."""
from collections import Counter
from typing import Literal

import numpy as np
from pydantic import BaseModel, ConfigDict, Field

from .atlas import TOPICS, Topic
from .concepts import model_id
from .ranking_v2 import Index, Point, unit

# Authored inventory descriptions and labels include one deliberate mismatch.
CATALOG = (
    ("Optical mirror blank", "Optics", "A telescope mirror gathers faint light."),
    ("Optical filter glass", "Optics", "A satellite filters the spectrum of stellar light."),
    ("Mirror coating sample", "Optics", "A telescope mirror reflects light from a star."),
    ("Resonator wire", "Acoustics", "A resonant string vibrates at a characteristic frequency."),
    ("Diaphragm film", "Acoustics", "A microphone records sound through vibration."),
    ("Soundboard sample", "Acoustics", "The instrument reflects sound in the concert hall."),
    ("Pressure membrane", "Marine", "An ocean sensor measures pressure in deep water."),
    ("Buoy shell", "Marine", "A vessel monitors waves on the ocean surface."),
    ("Cable jacket", "Marine", "An ocean sensor records deep water temperature."),
    ("Unreviewed mirror blank", "Marine", "A telescope mirror gathers light from the night sky."),
)


class Search(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    text: str = Field(min_length=1, max_length=400)
    interpretation: Topic | None = None
    corpus: Literal["knowledge", "inventory"] = "knowledge"


def explore(atlas, form):
    identity = model_id(atlas)
    query = Point(identity, unit(atlas.model.encode(form.text)))
    if form.corpus == "inventory":
        records = CATALOG
        vectors = np.array([atlas.model.encode(text) for _, _, text in records])
    else:
        records = [(text, topic, text) for text, topic in zip(atlas.model.documents, atlas.labels.tolist())]
        vectors = atlas.vectors
    ids = list(range(len(records)))
    index = Index(identity, ids, vectors)
    meanings = sorted(TOPICS, key=lambda t: -float(query.values @ atlas.directions[t]))[:2]
    directed = Point(identity, unit(query.values + atlas.directions[form.interpretation])) if form.interpretation else query
    items = []
    for i, (name, category, text) in enumerate(records):
        peers = [j for j in index.rank(Point(identity, vectors[i]), 4) if j != i][:3]
        votes = Counter(records[j][1] for j in peers)
        majority, count = votes.most_common(1)[0]
        items.append(dict(id=i, name=name, category=category, text=text, peers=peers,
                          anomalous=count >= 2 and majority != category, majority=majority, votes=count,
                          score=float(vectors[i] @ directed.values)))
    return dict(model_id=identity, interpretations=meanings, items=items,
                before=index.rank(query, len(ids)), after=index.rank(directed, len(ids)))

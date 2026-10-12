from pincushion.config import settings
from pincushion.indexers.antique_pattern_library import AntiquePatternLibraryIndexer
from pincushion.indexers.base import Indexer
from pincushion.indexers.cross_stitch_com import CrossStitchComIndexer
from pincushion.indexers.cross_stitch_quest import CrossStitchQuestIndexer
from pincushion.indexers.cyberstitchers import CyberstitchersIndexer
from pincushion.indexers.dmc import DMCFreeIndexer, DMCPaidIndexer
from pincushion.indexers.europeana import EuropeanaIndexer
from pincushion.indexers.free_patterns_online import FreePatternsOnlineIndexer
from pincushion.indexers.index_only import IndexOnlyIndexer
from pincushion.indexers.internet_archive import InternetArchiveIndexer
from pincushion.indexers.kenney import KenneyIndexer
from pincushion.indexers.lospec import LospecIndexer
from pincushion.indexers.opengameart import OpenGameArtIndexer
from pincushion.indexers.openverse import OpenverseIndexer
from pincushion.indexers.pixabay import PixabayIndexer
from pincushion.indexers.smithsonian import SmithsonianIndexer
from pincushion.indexers.wikimedia_commons import WikimediaCommonsIndexer
from pincushion.indexers.wizardi import WizardiIndexer
from pincushion.models import IndexerStatus

_indexers: dict[str, Indexer] = {}


def register_indexer(indexer: Indexer) -> None:
    _indexers[indexer.id] = indexer


def get_indexer(indexer_id: str) -> Indexer:
    if indexer_id not in _indexers:
        raise KeyError(f"Unknown indexer: {indexer_id}")
    return _indexers[indexer_id]


def list_indexers() -> list[Indexer]:
    return list(_indexers.values())


def bootstrap_indexers() -> None:
    register_indexer(InternetArchiveIndexer())
    register_indexer(WikimediaCommonsIndexer())
    register_indexer(OpenverseIndexer())
    register_indexer(OpenGameArtIndexer())
    register_indexer(KenneyIndexer())
    register_indexer(LospecIndexer())
    if (settings.pixabay_api_key or "").strip():
        register_indexer(PixabayIndexer())
    else:
        register_indexer(
            IndexOnlyIndexer(
                id="pixabay",
                name="Pixabay",
                source="Pixabay",
                site_url="https://pixabay.com/api/docs/",
                description="Free API key — set PINCUSHION_PIXABAY_API_KEY for illustration and craft-image search.",
                status=IndexerStatus.INDEX_ONLY,
                access_method="api",
            )
        )
    if (settings.europeana_api_key or "").strip():
        register_indexer(EuropeanaIndexer())
    else:
        register_indexer(
            IndexOnlyIndexer(
                id="europeana",
                name="Europeana",
                source="Europeana",
                site_url="https://www.europeana.eu",
                description="Set PINCUSHION_EUROPEANA_API_KEY (free at europeana.eu) to search European museum collections.",
                status=IndexerStatus.INDEX_ONLY,
                access_method="api",
            )
        )
    if (settings.si_api_key or "").strip():
        register_indexer(SmithsonianIndexer())
    else:
        register_indexer(
            IndexOnlyIndexer(
                id="smithsonian",
                name="Smithsonian Open Access",
                source="Smithsonian",
                site_url="https://www.si.edu/openaccess/devtools",
                description="Free API key at api.data.gov — set PINCUSHION_SI_API_KEY to enable search and download.",
                status=IndexerStatus.INDEX_ONLY,
                access_method="api",
            )
        )
    register_indexer(DMCFreeIndexer())
    register_indexer(DMCPaidIndexer())
    register_indexer(AntiquePatternLibraryIndexer())
    register_indexer(CrossStitchQuestIndexer())
    register_indexer(WizardiIndexer())
    register_indexer(CyberstitchersIndexer())
    register_indexer(CrossStitchComIndexer())
    register_indexer(FreePatternsOnlineIndexer())
    register_indexer(
        IndexOnlyIndexer(
            id="user_import",
            name="Your files",
            source="Local",
            site_url="",
            description="Manual Wanted entries and patterns imported from files you own.",
            status=IndexerStatus.INDEX_ONLY,
            access_method="manual",
        )
    )


async def shutdown_indexers() -> None:
    for idx in _indexers.values():
        if hasattr(idx, "close"):
            await idx.close()

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button, ButtonGroup, OverlayTrigger, Tooltip, Badge } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import cx from "classnames";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "../Shared/Icon";
import { GalleryLink, TagLink, SceneMarkerLink } from "../Shared/TagLink";
import { HoverPopover } from "../Shared/HoverPopover";
import { SweatDrops } from "../Shared/SweatDrops";
import { TruncatedText } from "../Shared/TruncatedText";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { SceneQueue } from "src/models/sceneQueue";
import { ConfigurationContext } from "src/hooks/Config";
import { PerformerPopoverButton } from "../Shared/PerformerPopoverButton";
import { GridCard } from "../Shared/GridCard/GridCard";
import { RatingBanner } from "../Shared/RatingBanner";
import { FormattedMessage } from "react-intl";
import {
  faBox,
  faCopy,
  faFilm,
  faImages,
  faMapMarkerAlt,
  faTag,
} from "@fortawesome/free-solid-svg-icons";
import { objectPath, objectTitle } from "src/core/files";
import { PreviewScrubber } from "./PreviewScrubber";
import { PatchComponent } from "src/patch";
import { StudioOverlay } from "../Shared/GridCard/StudioOverlay";
import { GroupTag } from "../Groups/GroupTag";
import { FileSize } from "../Shared/FileSize";
import { Link } from "react-router-dom";
import { getClient } from "src/core/StashService";
import { TagPopover } from "../Tags/TagPopover";

interface IScenePreviewProps {
  isPortrait: boolean;
  image?: string;
  video?: string;
  soundActive: boolean;
  vttPath?: string;
  onScrubberClick?: (timestamp: number) => void;
}

export const ScenePreview: React.FC<IScenePreviewProps> = ({
  image,
  video,
  isPortrait,
  soundActive,
  vttPath,
  onScrubberClick,
}) => {
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio > 0)
          // Catch is necessary due to DOMException if user hovers before clicking on page
          videoEl.current?.play()?.catch(() => {});
        else videoEl.current?.pause();
      });
    });

    if (videoEl.current) observer.observe(videoEl.current);
  });

  useEffect(() => {
    if (videoEl?.current?.volume)
      videoEl.current.volume = soundActive ? 0.05 : 0;
  }, [soundActive]);

  return (
    <div className={cx("scene-card-preview", { portrait: isPortrait })}>
      <img
        className="scene-card-preview-image"
        loading="lazy"
        src={image}
        alt=""
      />
      <video
        disableRemotePlayback
        playsInline
        muted={!soundActive}
        className="scene-card-preview-video"
        loop
        preload="none"
        ref={videoEl}
        src={video}
      />
      <PreviewScrubber vttPath={vttPath} onClick={onScrubberClick} />
    </div>
  );
};

interface ISceneCardProps {
  scene: GQL.SlimSceneDataFragment;
  width?: number;
  previewHeight?: number;
  index?: number;
  queue?: SceneQueue;
  compact?: boolean;
  selecting?: boolean;
  selected?: boolean | undefined;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  fromGroupId?: string;
}

const Description: React.FC<{
  sceneNumber?: number;
}> = ({ sceneNumber }) => {
  if (!sceneNumber) return null;

  return (
    <>
      <hr />
      {sceneNumber !== undefined && (
        <span className="scene-group-scene-number">
          <FormattedMessage id="scene" /> #{sceneNumber}
        </span>
      )}
    </>
  );
};

const SceneCardPopovers = PatchComponent(
  "SceneCard.Popovers",
  (props: ISceneCardProps) => {
    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    const sceneNumber = useMemo(() => {
      if (!props.fromGroupId) {
        return undefined;
      }

      const group = props.scene.groups.find(
        (g) => g.group.id === props.fromGroupId
      );
      return group?.scene_index ?? undefined;
    }, [props.fromGroupId, props.scene.groups]);

    function maybeRenderTagPopoverButton() {
      if (props.scene.tags.length <= 0) return;

      const popoverContent = props.scene.tags.map((tag) => (
        <TagLink key={tag.id} tag={tag} />
      ));

      return (
        <HoverPopover
          className="tag-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faTag} />
            <span>{props.scene.tags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderPerformerPopoverButton() {
      if (props.scene.performers.length <= 0) return;

      return (
        <PerformerPopoverButton
          performers={props.scene.performers}
          linkType="scene"
        />
      );
    }

    function maybeRenderGroupPopoverButton() {
      if (props.scene.groups.length <= 0) return;

      const popoverContent = props.scene.groups.map((sceneGroup) => (
        <GroupTag key={sceneGroup.group.id} group={sceneGroup.group} />
      ));

      return (
        <HoverPopover
          placement="bottom"
          content={popoverContent}
          className="group-count tag-tooltip"
        >
          <Button className="minimal">
            <Icon icon={faFilm} />
            <span>{props.scene.groups.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderSceneMarkerPopoverButton() {
      if (props.scene.scene_markers.length <= 0) return;

      const popoverContent = props.scene.scene_markers.map((marker) => {
        const markerWithScene = { ...marker, scene: { id: props.scene.id } };
        return <SceneMarkerLink key={marker.id} marker={markerWithScene} />;
      });

      return (
        <HoverPopover
          className="marker-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faMapMarkerAlt} />
            <span>{props.scene.scene_markers.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOCounter() {
      if (props.scene.o_counter) {
        return (
          <div className="o-count">
            <Button className="minimal">
              <span className="fa-icon">
                <SweatDrops />
              </span>
              <span>{props.scene.o_counter}</span>
            </Button>
          </div>
        );
      }
    }

    function maybeRenderGallery() {
      if (props.scene.galleries.length <= 0) return;

      const popoverContent = props.scene.galleries.map((gallery) => (
        <GalleryLink key={gallery.id} gallery={gallery} />
      ));

      return (
        <HoverPopover
          className="gallery-count"
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faImages} />
            <span>{props.scene.galleries.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOrganized() {
      if (props.scene.organized) {
        return (
          <OverlayTrigger
            overlay={<Tooltip id="organised-tooltip">{"Organized"}</Tooltip>}
            placement="bottom"
          >
            <div className="organized">
              <Button className="minimal">
                <Icon icon={faBox} />
              </Button>
            </div>
          </OverlayTrigger>
        );
      }
    }

    function maybeRenderDupeCopies() {
      const phash = file
        ? file.fingerprints.find((fp) => fp.type === "phash")
        : undefined;

      if (phash) {
        return (
          <div className="other-copies extra-scene-info">
            <Button
              href={NavUtils.makeScenesPHashMatchUrl(phash.value)}
              className="minimal"
            >
              <Icon icon={faCopy} />
            </Button>
          </div>
        );
      }
    }

    function maybeRenderPopoverButtonGroup() {
      if (
        !props.compact &&
        (props.scene.tags.length > 0 ||
          props.scene.performers.length > 0 ||
          props.scene.groups.length > 0 ||
          props.scene.scene_markers.length > 0 ||
          props.scene?.o_counter ||
          props.scene.galleries.length > 0 ||
          props.scene.organized ||
          sceneNumber !== undefined)
      ) {
        return (
          <>
            <Description sceneNumber={sceneNumber} />
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderTagPopoverButton()}
              {maybeRenderPerformerPopoverButton()}
              {maybeRenderGroupPopoverButton()}
              {maybeRenderSceneMarkerPopoverButton()}
              {maybeRenderOCounter()}
              {maybeRenderGallery()}
              {maybeRenderOrganized()}
              {maybeRenderDupeCopies()}
            </ButtonGroup>
          </>
        );
      }
    }

    return <>{maybeRenderPopoverButtonGroup()}</>;
  }
);

const SceneCardDetails = PatchComponent(
  "SceneCard.Details",
  (props: ISceneCardProps) => {
    return (
      <div className="scene-card__details">
        <span className="scene-card__date">{props.scene.date}</span>
        <span className="file-path extra-scene-info">
          {objectPath(props.scene)}
        </span>
        <TruncatedText
          className="scene-card__description"
          text={props.scene.details}
          lineCount={3}
        />
      </div>
    );
  }
);

const SceneCardOverlays = PatchComponent(
  "SceneCard.Overlays",
  (props: ISceneCardProps) => {
    return <StudioOverlay studio={props.scene.studio} />;
  }
);

const SceneCardImage = PatchComponent(
  "SceneCard.Image",
  (props: ISceneCardProps) => {
    const history = useHistory();
    const { configuration } = React.useContext(ConfigurationContext);
    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );

    function maybeRenderSceneSpecsOverlay() {
      return (
        <div className="scene-specs-overlay">
          {file?.size !== undefined ? (
            <span className="overlay-filesize extra-scene-info">
              <FileSize size={file.size} />
            </span>
          ) : (
            ""
          )}
          {file?.width && file?.height ? (
            <span className="overlay-resolution">
              {" "}
              {TextUtils.resolution(file?.width, file?.height)}
            </span>
          ) : (
            ""
          )}
          {(file?.duration ?? 0) >= 1 ? (
            <span className="overlay-duration">
              {TextUtils.secondsToTimestamp(file?.duration ?? 0)}
            </span>
          ) : (
            ""
          )}
        </div>
      );
    }

    function maybeRenderInteractiveSpeedOverlay() {
      return (
        <div className="scene-interactive-speed-overlay">
          {props.scene.interactive_speed ?? ""}
        </div>
      );
    }
    
    function maybeRenderDateOverlay() {
      // Only display date if scene has a date, files exist, has tags, and tag display setting is enabled
      if (props.scene.date && 
          props.scene.files.length > 0 && 
          props.scene.tags && 
          props.scene.tags.length > 0 && 
          configuration?.ui?.displayTagsInsteadOfFilenameWhenNoTitle === true) {
        return (
          <div className="scene-specs-overlay date-overlay">
            <span>{props.scene.date}</span>
          </div>
        );
      }
      return null;
    }

    function onScrubberClick(timestamp: number) {
      const link = props.queue
        ? props.queue.makeLink(props.scene.id, {
            sceneIndex: props.index,
            continue: cont,
            start: timestamp,
          })
        : `/scenes/${props.scene.id}?t=${timestamp}`;

      history.push(link);
    }

    function isPortrait() {
      const width = file?.width ? file.width : 0;
      const height = file?.height ? file.height : 0;
      return height > width;
    }

    return (
      <>
        <ScenePreview
          image={props.scene.paths.screenshot ?? undefined}
          video={props.scene.paths.preview ?? undefined}
          isPortrait={isPortrait()}
          soundActive={configuration?.interface?.soundOnPreview ?? false}
          vttPath={props.scene.paths.vtt ?? undefined}
          onScrubberClick={onScrubberClick}
        />
        <RatingBanner rating={props.scene.rating100} />
        {maybeRenderSceneSpecsOverlay()}
        {maybeRenderInteractiveSpeedOverlay()}
        {maybeRenderDateOverlay()}
      </>
    );
  }
);

// Simple component to display tags
const TagsContainer = PatchComponent(
  "TagsContainer",
  ({ tags, performers, scene_markers, sceneId }: { 
    tags: any[], 
    performers?: any[],
    scene_markers?: any[],
    sceneId?: string
  }) => {
    // Define tag type
    interface Tag {
      id: string;
      name: string;
      isPerformer?: boolean;
      performer?: any;
      fromPerformer?: string;
      isMarkerPrimary?: boolean;
      isMarkerSub?: boolean;
      fromMarker?: boolean;
      seconds?: number;
      [key: string]: any;
    }
    
    const [performerTags, setPerformerTags] = useState<{[key: string]: any[]}>({});
    
    // Function to fetch performer tags - memoized to prevent recreation on renders
    const fetchPerformerTags = useCallback(async (performerId: string) => {
      try {
        const result = await getClient().query<GQL.FindPerformerQuery>({
          query: GQL.FindPerformerDocument,
          variables: { id: performerId },
        });
        
        return result.data?.findPerformer?.tags || [];
      } catch (error) {
        console.error(`Error fetching tags for performer ${performerId}:`, error);
        return [];
      }
    }, []);
    
    // Fetch all performer tags once when component mounts or performers change
    useEffect(() => {
      if (!performers?.length) return;
      
      const fetchAllPerformerTags = async () => {
        const tagsMap: {[key: string]: any[]} = {};
        
        // Create array of promises to fetch all performer tags in parallel
        const promises = performers.map(async (performer) => {
          if (!performer?.id) return;
          
          const tags = await fetchPerformerTags(performer.id);
          tagsMap[performer.id] = tags;
        });
        
        // Wait for all fetches to complete
        await Promise.all(promises);
        setPerformerTags(tagsMap);
      };
      
      fetchAllPerformerTags();
    }, [performers, fetchPerformerTags]);
    
    // Create array with combined tags from performers, scene and markers
    const combinedTags = useMemo<{
      performerTags: Tag[],
      sceneTags: Tag[],
      markerTags: Tag[]
    }>(() => {
      // Use Sets to track IDs for faster duplicate checking
      const addedTagIds = new Set<string>();
      
      const performerTagsResult: Tag[] = [];
      const sceneTagsResult: Tag[] = [];
      const markerTagsResult: Tag[] = [];
      
      // Add all performer tags
      if (performers?.length) {
        performers.forEach(performer => {
          if (!performer?.id) return;
          
          // Add performer as a special tag
          performerTagsResult.push({
            id: `performer-${performer.id}`,
            name: performer.name,
            isPerformer: true,
            performer
          });
          
          // Add tags connected to the performer
          const pTags = performerTags[performer.id] || [];
          pTags.forEach(tag => {
            if (tag?.id && !addedTagIds.has(tag.id)) {
              addedTagIds.add(tag.id);
              performerTagsResult.push({
                ...tag,
                fromPerformer: performer.name
              });
            }
          });
        });
      }
      
      // Add scene tags (excluding those already in performer tags)
      if (tags?.length) {
        tags.forEach(tag => {
          if (tag?.id && !addedTagIds.has(tag.id)) {
            addedTagIds.add(tag.id);
            sceneTagsResult.push(tag);
          }
        });
      }
      
      // Add scene marker tags (excluding those already in performer or scene tags)
      if (scene_markers?.length) {
        scene_markers.forEach(marker => {
          if (marker?.primary_tag) {
            // Add primary tag from marker if not already added
            const primaryTag = marker.primary_tag;
            if (primaryTag?.id && !addedTagIds.has(primaryTag.id)) {
              addedTagIds.add(primaryTag.id);
              markerTagsResult.push({
                ...primaryTag,
                isMarkerPrimary: true,
                fromMarker: true,
                seconds: marker.seconds
              });
            }
            
            // Add tags from marker if not already added
            if (marker.tags?.length) {
              marker.tags.forEach((tag: { id: string; name: string }) => {
                if (tag?.id && !addedTagIds.has(tag.id)) {
                  addedTagIds.add(tag.id);
                  markerTagsResult.push({
                    ...tag,
                    fromMarker: true,
                    isMarkerSub: true,
                    seconds: marker.seconds
                  });
                }
              });
            }
          }
        });
      }
      
      return {
        performerTags: performerTagsResult,
        sceneTags: sceneTagsResult,
        markerTags: markerTagsResult
      };
    }, [tags, performers, performerTags, scene_markers]);
    
    const hasAnyTags = 
      combinedTags.performerTags.length > 0 || 
      combinedTags.sceneTags.length > 0 || 
      combinedTags.markerTags.length > 0;
    
    if (!hasAnyTags) {
      return null;
    }
    
    const renderTagRow = (tagList: Tag[], className?: string) => {
      if (!tagList?.length) return null;
      
      return (
        <div className={`scene-tags-row ${className || ''}`}>
          {tagList.map((tag: Tag) => {
            // Performer tag case
            if (tag.isPerformer) {
              const popoverContent = (
                <div className="performer-tag-container row">
                  <Link
                    to={`/performers/${tag.performer.id}`}
                    className="performer-tag col m-auto zoom-2"
                  >
                    <img
                      className="image-thumbnail"
                      alt={tag.performer.name ?? ""}
                      src={tag.performer.image_path ?? ""}
                    />
                  </Link>
                </div>
              );

              return (
                <Badge 
                  key={tag.id}
                  className="tag-item"
                  variant="secondary"
                >
                  <HoverPopover 
                    className="performer-tag-wrapper"
                    placement="bottom"
                    content={popoverContent}
                  >
                    <Link to={`/performers/${tag.performer.id}`}>
                      {tag.name}
                    </Link>
                  </HoverPopover>
                </Badge>
              );
            }
            
            // Tag from marker with timestamp link
            if (tag.fromMarker && tag.seconds !== undefined && sceneId) {
              return (
                <Badge 
                  key={tag.id}
                  className="tag-item"
                  variant="secondary"
                >
                  <TagPopover id={tag.id} placement="top">
                    <Link to={`/scenes/${sceneId}?t=${tag.seconds}`}>
                      {tag.name}
                    </Link>
                  </TagPopover>
                </Badge>
              );
            }
            
            // Regular tag
            return <TagLink key={tag.id} tag={tag} className="tag-item" />;
          })}
        </div>
      );
    };
    
    return (
      <div className="scene-tags-container">
        {renderTagRow(combinedTags.performerTags, 'performer-tags-row')}
        {renderTagRow(combinedTags.sceneTags, 'scene-tags-row')}
        {renderTagRow(combinedTags.markerTags, 'marker-tags-row')}
      </div>
    );
  }
);

export const SceneCard = PatchComponent(
  "SceneCard",
  (props: ISceneCardProps) => {
    const { configuration } = React.useContext(ConfigurationContext);

    const file = useMemo(
      () => (props.scene.files.length > 0 ? props.scene.files[0] : undefined),
      [props.scene]
    );


    function zoomIndex() {
      if (!props.compact && props.zoomIndex !== undefined) {
        return `zoom-${props.zoomIndex}`;
      }

      return "";
    }

    function filelessClass() {
      if (!props.scene.files.length) {
        return "fileless";
      }

      return "";
    }

    const cont = configuration?.interface.continuePlaylistDefault ?? false;

    const sceneLink = props.queue
      ? props.queue.makeLink(props.scene.id, {
          sceneIndex: props.index,
          continue: cont,
        })
      : `/scenes/${props.scene.id}`;

    // Get card display settings
    const displayTitle = objectTitle(props.scene);
    const hasNoTitle = !props.scene.title;
    const hasTags = props.scene.tags && props.scene.tags.length > 0;
    const shouldShowTags = hasNoTitle && 
                          hasTags && 
                          configuration?.ui?.displayTagsInsteadOfFilenameWhenNoTitle === true;

    // Create CSS class based on conditions
    const cardClass = cx(
      'scene-card', 
      zoomIndex(), 
      filelessClass(), 
      { 'has-tag-title': shouldShowTags }
    );

    // Custom details section based on display settings
    const detailsContent = shouldShowTags ? (
      <>
        <TagsContainer 
          tags={props.scene.tags} 
          performers={props.scene.performers}
          scene_markers={props.scene.scene_markers}
          sceneId={props.scene.id}
        />
        <div className="scene-card__details scene-card__other-details">
          <span className="file-path extra-scene-info">
            {objectPath(props.scene)}
          </span>
          <TruncatedText
            className="scene-card__description"
            text={props.scene.details}
            lineCount={3}
          />
        </div>
      </>
    ) : (
      <SceneCardDetails {...props} />
    );

    return (
      <GridCard
        className={cardClass}
        url={sceneLink}
        title={shouldShowTags ? "" : displayTitle}
        width={props.width}
        linkClassName="scene-card-link"
        thumbnailSectionClassName="video-section"
        resumeTime={props.scene.resume_time ?? undefined}
        duration={file?.duration ?? undefined}
        interactiveHeatmap={
          props.scene.interactive_speed
            ? props.scene.paths.interactive_heatmap ?? undefined
            : undefined
        }
        image={<SceneCardImage {...props} />}
        overlays={<SceneCardOverlays {...props} />}
        details={detailsContent}
        popovers={shouldShowTags ? undefined : <SceneCardPopovers {...props} />}
        selected={props.selected}
        selecting={props.selecting}
        onSelectedChanged={props.onSelectedChanged}
      />
    );
  }
);

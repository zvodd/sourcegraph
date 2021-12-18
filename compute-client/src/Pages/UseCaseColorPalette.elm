module Pages.UseCaseColorPalette exposing (Model, Msg, page)

import Effect exposing (Effect)
import Element exposing (..)
import Gen.Params.UseCaseCodeOwnershipAuthor exposing (Params)
import Gen.Params.UseCaseCodeOwnershipTopical exposing (Params)
import Gen.Params.UseCaseColorPalette exposing (Params)
import Page
import Pages.UseCaseBase exposing (Msg(..))
import Process
import Request
import Shared exposing (Msg)
import Styling exposing (..)
import Task
import Types exposing (..)
import View exposing (View)



-- INIT


init : ( Model, Effect Msg )
init =
    let
        ( model, _ ) =
            Pages.UseCaseBase.init

        fileValue =
            ""
    in
    ( { model
        | title = "Extract and curate visual styles"
        , description = "Color palette from repository data"
        , query = "repo:sourcegraph/sourcegraph " ++ "file:" ++ fileValue ++ " content:output(#([a-fA-F0-9]{6})[^a-fA-F0-9] -> $1)"
        , genericInput1 = fileValue
        , genericInput2 = ""
        , visualKind = ColorPalette
        , supportedVisualKinds = [ ColorPalette, CSV ]
        , dataPoints = 25
      }
    , Effect.fromCmd (Task.perform identity (Task.succeed RunCompute))
    )


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ _ =
    Page.advanced
        { init = init
        , update = update
        , view = view
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    Pages.UseCaseBase.Model



-- UPDATE


type alias Msg =
    Pages.UseCaseBase.Msg


update : Msg -> Model -> ( Model, Effect Msg )
update msg model =
    let
        debounceQueryMillis =
            400
    in
    case msg of
        OnGenericInput1 genericInput1 ->
            let
                fileValue =
                    genericInput1
            in
            ( { model
                | genericInput1 = genericInput1
                , query = "repo:sourcegraph/sourcegraph " ++ "file:" ++ fileValue ++ " content:output(#([a-fA-F0-9]{6})[^a-fA-F0-9] -> $1)"
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        _ ->
            Pages.UseCaseBase.update msg model



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions =
    Pages.UseCaseBase.subscriptions



-- VIEW


view : Model -> View Msg
view model =
    Pages.UseCaseBase.view model "only these files" ""

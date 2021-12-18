module Pages.UseCaseCodeOwnershipAuthor exposing (Model, Msg, page)

import Effect exposing (Effect)
import Element exposing (..)
import Gen.Params.UseCaseCodeOwnershipAuthor exposing (Params)
import Gen.Params.UseCaseCodeOwnershipTopical exposing (Params)
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

        authors =
            []

        authorValue =
            String.join "|" authors

        afterValue =
            ""
    in
    ( { model
        | title = "Code activity by teammates"
        , description = "Find what teammates have been working on"
        , query = "repo:sourcegraph/sourcegraph$ content:output((\\w+) -> $1) -file:test type:commit count:all " ++ "after:\"" ++ afterValue ++ "\"" ++ " " ++ "author:(" ++ authorValue ++ ")"
        , genericInput1 = authorValue
        , genericInput2 = afterValue
        , visualKind = BarChart
        , supportedVisualKinds = [ BarChart, Table ]
      }
    , Effect.none
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
                authorValue =
                    String.join "|" (List.map String.trimLeft (String.split "," genericInput1))

                afterValue =
                    model.genericInput2
            in
            ( { model
                | genericInput1 = genericInput1
                , query = "repo:sourcegraph/sourcegraph$ content:output((\\w+) -> $1) -file:test type:commit count:all " ++ "after:\"" ++ afterValue ++ "\"" ++ " " ++ "author:(" ++ authorValue ++ ")"
                , debounce = model.debounce + 1
                , queryModifiedSinceLastRequest = True
              }
            , Effect.fromCmd (Task.perform (\_ -> OnDebounce) (Process.sleep debounceQueryMillis))
            )

        OnGenericInput2 genericInput2 ->
            let
                authorValue =
                    String.join "|" (List.map String.trimLeft (String.split "," model.genericInput1))

                afterValue =
                    genericInput2
            in
            ( { model
                | genericInput2 = genericInput2
                , query = "repo:sourcegraph/sourcegraph$ content:output((\\w+) -> $1) -file:test type:commit count:all " ++ "after:\"" ++ afterValue ++ "\"" ++ " " ++ "author:(" ++ authorValue ++ ")"
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
    Pages.UseCaseBase.view model "authors" "time frame"

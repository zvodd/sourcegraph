module Pages.UseCaseCodeUsage exposing (Model, Msg, page)

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

        patternValue =
            ""
    in
    ( { model
        | title = "API and Code Usage"
        , description = "Find how functions are called. NOTE: this query is hardcoded to emit the value of :[v] for a structural search. Go create a custom query in the advanced interface to get full control."
        , query = "repo:sourcegraph/sourcegraph$ file:.go -file:test content:output.structural(" ++ patternValue ++ " -> :[v]) patterntype:structural count:1000"
        , genericInput1 = patternValue
        , genericInput2 = ""
        , visualKind = Table
        , supportedVisualKinds = [ Table, CSV ]
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
                patternValue =
                    genericInput1
            in
            ( { model
                | genericInput1 = genericInput1
                , query = "repo:sourcegraph/sourcegraph$ file:.go -file:test content:output.structural(" ++ patternValue ++ " -> :[v]) patterntype:structural count:1000"
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
    Pages.UseCaseBase.view model "pattern" ""
